import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { authenticateToken, requireRole } from '../middleware/auth';
import { getSignedUrlFromBucket, getStorage } from '../services/gcpStorage';
import { startIngestion, getIngestionStatus, ensureIngestionTables, getAllChannelMeta } from '../services/channelIngestion';
import {
  ensureCompetitorCutTables,
  ingestOneVideo,
  searchSimilarCuts,
  rerankCandidates,
  invalidateCutCache,
  estimateIngestCostUsd,
} from '../services/competitorCutAnalysis';
import { probeBin } from '../services/channelIngestion';
import { query } from '../db';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export const competitorAnalysisRouter = Router();

// Reuse script_engine DB — same host, different database
let sePool: Pool | null = null;

function getPool(): Pool {
  if (!sePool) {
    const mainDbUrl = process.env.DATABASE_URL || '';
    const host = mainDbUrl.match(/@([^:]+):/)?.[1] || '34.58.157.140';
    sePool = new Pool({
      host,
      port: 5432,
      database: 'script_engine',
      user: 'script_engine',
      password: process.env.SCRIPT_ENGINE_DB_PASSWORD || 'MC@w@W_J:1?K{pUi(ht8mh)sUh4MzVfX',
      max: 3,
    });
  }
  return sePool;
}

async function seQuery(sql: string, params?: any[]) {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return result.rows;
}

// The script engine stores competitor videos in its own GCS bucket
const SCRIPT_ENGINE_BUCKET = process.env.SCRIPT_ENGINE_GCS_BUCKET || 'knavishmantis-script-engine';

// Strip gs://bucket-name/ prefix if present so we get just the bucket-relative path
function extractBucketPath(gcsPath: string): { bucket: string; path: string } {
  if (gcsPath.startsWith('gs://')) {
    const withoutScheme = gcsPath.slice(5);
    const slash = withoutScheme.indexOf('/');
    return slash >= 0
      ? { bucket: withoutScheme.slice(0, slash), path: withoutScheme.slice(slash + 1) }
      : { bucket: withoutScheme, path: '' };
  }
  return { bucket: SCRIPT_ENGINE_BUCKET, path: gcsPath };
}

function inferContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mkv') return 'video/x-matroska';
  return 'video/mp4';
}

async function getCompetitorSignedUrl(gcsPath: string, expiresIn = 3600): Promise<string> {
  const { bucket: bucketName, path: filePath } = extractBucketPath(gcsPath);
  const contentType = inferContentType(filePath);
  return getSignedUrlFromBucket(bucketName, filePath, expiresIn, contentType);
}

// GET /api/competitor-analysis/videos/:id/stream
// Proxy the GCS video through the backend with proper headers for iOS Safari.
// Accepts JWT via ?token= query param since <video> elements can't send Bearer headers.
// Registered BEFORE the auth middleware so the video element URL works without custom headers.
competitorAnalysisRouter.get('/videos/:id/stream', async (req: Request, res: Response) => {
  const token = req.query.token as string;
  if (!token) { res.status(401).end(); return; }
  try { jwt.verify(token, config.jwtSecret); } catch { res.status(401).end(); return; }

  try {
    const { id } = req.params;
    const rows = await seQuery('SELECT gcs_path FROM videos WHERE id = $1', [id]);
    if (!rows.length || !rows[0].gcs_path) { res.status(404).end(); return; }

    const { bucket: bucketName, path: filePath } = extractBucketPath(rows[0].gcs_path);
    const storage = getStorage();
    const file = storage.bucket(bucketName).file(filePath);

    const [metadata] = await file.getMetadata();
    const fileSize = parseInt(String(metadata.size), 10);
    const contentType = inferContentType(filePath);

    const rangeHeader = req.headers['range'];
    let start = 0;
    let end = fileSize - 1;
    let statusCode = 200;

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        start = parseInt(match[1], 10);
        end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
        statusCode = 206;
      }
    }

    const headers: Record<string, string | number> = {
      'Content-Type': contentType,
      'Content-Length': end - start + 1,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    };
    if (statusCode === 206) {
      headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
    }

    res.writeHead(statusCode, headers);

    const readStream = file.createReadStream({ start, end });

    readStream.on('error', (err) => {
      console.error('GCS stream error for video', id, err.message);
      if (!res.writableEnded) res.end();
    });

    req.on('close', () => readStream.destroy());

    readStream.pipe(res, { end: true });
  } catch (e: any) {
    console.error('Stream handler error for video', req.params.id, e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// All routes below require admin auth
competitorAnalysisRouter.use(authenticateToken);
competitorAnalysisRouter.use(requireRole('admin'));

// Ensure competitor_reviews table exists in script_engine DB
// video_id is INTEGER to match videos.id (SERIAL)
async function ensureTable() {
  await seQuery(`
    CREATE TABLE IF NOT EXISTS competitor_reviews (
      id SERIAL PRIMARY KEY,
      video_id INTEGER NOT NULL,
      notes TEXT,
      percentile_guess INTEGER CHECK (percentile_guess >= 0 AND percentile_guess <= 100),
      rating INTEGER CHECK (rating >= 1 AND rating <= 10),
      reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(video_id)
    )
  `);
  // Migrate TEXT → INTEGER if the table was created before this fix
  await seQuery(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'competitor_reviews' AND column_name = 'video_id' AND data_type = 'text'
      ) THEN
        ALTER TABLE competitor_reviews ALTER COLUMN video_id TYPE INTEGER USING video_id::INTEGER;
      END IF;
    END $$;
  `);
  // Add all structured analysis columns if missing
  await seQuery(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'competitor_reviews' AND column_name = 'hook_type') THEN
        ALTER TABLE competitor_reviews ADD COLUMN hook_type TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'competitor_reviews' AND column_name = 'topic_category') THEN
        ALTER TABLE competitor_reviews ADD COLUMN topic_category TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'competitor_reviews' AND column_name = 'steal_this') THEN
        ALTER TABLE competitor_reviews ADD COLUMN steal_this TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'competitor_reviews' AND column_name = 'visual_verbal') THEN
        ALTER TABLE competitor_reviews ADD COLUMN visual_verbal TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'competitor_reviews' AND column_name = 'initial_analysis') THEN
        ALTER TABLE competitor_reviews ADD COLUMN initial_analysis TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'competitor_reviews' AND column_name = 'hook_notes') THEN
        ALTER TABLE competitor_reviews ADD COLUMN hook_notes TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'competitor_reviews' AND column_name = 'concept_notes') THEN
        ALTER TABLE competitor_reviews ADD COLUMN concept_notes TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'competitor_reviews' AND column_name = 'pacing_notes') THEN
        ALTER TABLE competitor_reviews ADD COLUMN pacing_notes TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'competitor_reviews' AND column_name = 'payoff_notes') THEN
        ALTER TABLE competitor_reviews ADD COLUMN payoff_notes TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'competitor_reviews' AND column_name = 'emotion') THEN
        ALTER TABLE competitor_reviews ADD COLUMN emotion TEXT;
      END IF;
    END $$;
  `);
  await seQuery(`
    CREATE TABLE IF NOT EXISTS channel_notes (
      channel TEXT PRIMARY KEY,
      notes_md TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

ensureTable().catch(console.error);

// Also ensure ingestion tables exist on startup
getPool().query('SELECT 1').then(() => ensureIngestionTables(getPool())).catch(() => {});

// And ensure the competitor_cuts table + videos.cuts_* columns exist
getPool().query('SELECT 1').then(() => ensureCompetitorCutTables(getPool())).catch(err =>
  logger.error('ensureCompetitorCutTables failed', { error: err?.message })
);

// GET /api/competitor-analysis/channels
// Returns per-channel stats with rich video metrics + channel meta (display_name, mc_username)
competitorAnalysisRouter.get('/channels', async (_req: Request, res: Response) => {
  try {
    const rows = await seQuery(`
      WITH channel_videos AS (
        SELECT
          id,
          channel,
          views,
          (PERCENT_RANK() OVER (PARTITION BY channel ORDER BY views) * 100)::INTEGER AS actual_percentile
        FROM videos
        WHERE is_short = true AND gcs_path IS NOT NULL
      ),
      stats AS (
        SELECT
          cv.channel,
          COUNT(*)::INTEGER AS total,
          COUNT(cr.id)::INTEGER AS reviewed,
          ROUND(AVG(cv.views))::BIGINT AS avg_views,
          MAX(cv.views)::BIGINT AS max_views,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cv.views)::BIGINT AS median_views,
          ROUND(AVG(ABS(cr.percentile_guess - cv.actual_percentile)))::INTEGER AS avg_error
        FROM channel_videos cv
        LEFT JOIN competitor_reviews cr ON cr.video_id = cv.id
        GROUP BY cv.channel
      )
      SELECT s.*, cm.display_name, cm.mc_username
      FROM stats s
      LEFT JOIN channel_meta cm ON cm.channel = s.channel
      ORDER BY avg_views DESC
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/competitor-analysis/channels
// Start ingestion for a new channel
competitorAnalysisRouter.post('/channels', async (req: Request, res: Response) => {
  try {
    const { handle, displayName, mcUsername } = req.body;
    if (!handle || !displayName) {
      return res.status(400).json({ error: 'handle and displayName are required' });
    }
    if (!process.env.YOUTUBE_API_KEY) {
      return res.status(500).json({ error: 'YOUTUBE_API_KEY not configured on server' });
    }

    // Derive channel name from displayName (used as DB key matching videos.channel)
    const channel = displayName.trim();

    const jobId = await startIngestion(channel, handle, displayName, mcUsername || displayName);
    res.json({ jobId, channel });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/competitor-analysis/channels/:channel/ingest
// Returns the latest ingestion job status for a channel
competitorAnalysisRouter.get('/channels/:channel/ingest', async (req: Request, res: Response) => {
  try {
    const { channel } = req.params;
    const job = await getIngestionStatus(channel);
    res.json(job || { status: 'none' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/competitor-analysis/my-shorts
// Returns best 5 (by views) of the last 10 uploaded shorts from the main DB
competitorAnalysisRouter.get('/my-shorts', async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT
        s.id,
        s.title,
        s.youtube_video_id,
        s.script_content,
        s.reflection_rating,
        s.reflection_what_worked,
        COALESCE(ya.views, 0)::BIGINT AS views
      FROM shorts s
      LEFT JOIN youtube_video_analytics ya ON ya.video_id = s.youtube_video_id
      WHERE s.status = 'uploaded'
      ORDER BY COALESCE(s.editing_completed_at, s.updated_at) DESC
      LIMIT 10
    `);
    // Pick top 5 by views from the last 10
    const top5 = result.rows
      .sort((a: any, b: any) => Number(b.views) - Number(a.views))
      .slice(0, 5);
    res.json(top5);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/competitor-analysis/channels/:channel/next
// Returns a random unreviewed video for this channel to start a session
competitorAnalysisRouter.get('/channels/:channel/next', async (req: Request, res: Response) => {
  try {
    const { channel } = req.params;
    const browse = req.query.browse === 'true';
    const rows = await seQuery(`
      SELECT v.id, v.title, v.published_at, v.duration_sec, v.gcs_path, v.auto_captions, v.views
      FROM videos v
      LEFT JOIN competitor_reviews cr ON cr.video_id = v.id
      WHERE v.channel = $1
        AND v.is_short = true
        AND v.gcs_path IS NOT NULL
        ${browse ? '' : 'AND cr.id IS NULL'}
      ORDER BY (v.published_at >= NOW() - INTERVAL '6 months') DESC, RANDOM()
      LIMIT 1
    `, [channel]);

    if (rows.length === 0) {
      return res.status(404).json({ error: browse ? 'No videos for this channel' : 'No unreviewed videos for this channel' });
    }
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/competitor-analysis/videos/:id/url
// Generates a signed GCS URL for streaming the video
competitorAnalysisRouter.get('/videos/:id/url', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rows = await seQuery('SELECT gcs_path FROM videos WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Video not found' });

    const gcsPath = rows[0].gcs_path;
    if (!gcsPath) return res.status(404).json({ error: 'No GCS path for this video' });

    const url = await getCompetitorSignedUrl(gcsPath, 3600);
    res.json({ url });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/competitor-analysis/videos/:id/review
// Saves all review fields (called on Reveal and on rating)
competitorAnalysisRouter.post('/videos/:id/review', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      notes, percentile_guess, rating,
      hook_type, topic_category, steal_this,
      visual_verbal, initial_analysis,
      hook_notes, concept_notes, pacing_notes, payoff_notes, emotion,
    } = req.body;

    await seQuery(`
      INSERT INTO competitor_reviews (
        video_id, notes, percentile_guess, rating,
        hook_type, topic_category, steal_this,
        visual_verbal, initial_analysis,
        hook_notes, concept_notes, pacing_notes, payoff_notes, emotion,
        reviewed_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CURRENT_TIMESTAMP)
      ON CONFLICT (video_id) DO UPDATE SET
        notes               = EXCLUDED.notes,
        percentile_guess    = EXCLUDED.percentile_guess,
        rating              = COALESCE(EXCLUDED.rating, competitor_reviews.rating),
        hook_type           = COALESCE(EXCLUDED.hook_type, competitor_reviews.hook_type),
        topic_category      = COALESCE(EXCLUDED.topic_category, competitor_reviews.topic_category),
        steal_this          = COALESCE(EXCLUDED.steal_this, competitor_reviews.steal_this),
        visual_verbal       = COALESCE(EXCLUDED.visual_verbal, competitor_reviews.visual_verbal),
        initial_analysis    = COALESCE(EXCLUDED.initial_analysis, competitor_reviews.initial_analysis),
        hook_notes          = COALESCE(EXCLUDED.hook_notes, competitor_reviews.hook_notes),
        concept_notes       = COALESCE(EXCLUDED.concept_notes, competitor_reviews.concept_notes),
        pacing_notes        = COALESCE(EXCLUDED.pacing_notes, competitor_reviews.pacing_notes),
        payoff_notes        = COALESCE(EXCLUDED.payoff_notes, competitor_reviews.payoff_notes),
        emotion             = COALESCE(EXCLUDED.emotion, competitor_reviews.emotion),
        reviewed_at         = CURRENT_TIMESTAMP
    `, [
      parseInt(id),
      notes || null, percentile_guess ?? null, rating ?? null,
      hook_type || null, topic_category || null, steal_this || null,
      visual_verbal || null, initial_analysis || null,
      hook_notes || null, concept_notes || null, pacing_notes || null, payoff_notes || null, emotion || null,
    ]);

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/competitor-analysis/videos/:id/reveal
// Returns actual stats + percentile rank within channel, plus existing review
competitorAnalysisRouter.get('/videos/:id/reveal', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const videoRows = await seQuery('SELECT channel FROM videos WHERE id = $1', [id]);
    if (videoRows.length === 0) return res.status(404).json({ error: 'Video not found' });
    const { channel } = videoRows[0];

    const [revealRows, reviewRows] = await Promise.all([
      seQuery(`
        WITH ranked AS (
          SELECT
            id, title, views, likes, duration_sec, published_at,
            (PERCENT_RANK() OVER (ORDER BY views) * 100)::INTEGER AS actual_percentile,
            RANK() OVER (ORDER BY views DESC)::INTEGER AS rank_from_top,
            COUNT(*) OVER ()::INTEGER AS total_in_channel
          FROM videos
          WHERE channel = $1 AND is_short = true AND gcs_path IS NOT NULL
        )
        SELECT * FROM ranked WHERE id = $2
      `, [channel, id]),
      seQuery(`
        SELECT notes, percentile_guess, rating,
               hook_type, topic_category, steal_this,
               visual_verbal, initial_analysis,
               hook_notes, concept_notes, pacing_notes, payoff_notes, emotion
        FROM competitor_reviews WHERE video_id = $1
      `, [parseInt(id)]),
    ]);

    if (revealRows.length === 0) return res.status(404).json({ error: 'Video not found in channel' });

    res.json({
      ...revealRows[0],
      review: reviewRows[0] || null,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/competitor-analysis/channels/:channel/notes
competitorAnalysisRouter.get('/channels/:channel/notes', async (req: Request, res: Response) => {
  try {
    const { channel } = req.params;
    const rows = await seQuery('SELECT notes_md FROM channel_notes WHERE channel = $1', [channel]);
    res.json({ notes_md: rows[0]?.notes_md ?? '' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/competitor-analysis/channels/:channel/notes
competitorAnalysisRouter.put('/channels/:channel/notes', async (req: Request, res: Response) => {
  try {
    const { channel } = req.params;
    const { notes_md } = req.body;
    await seQuery(`
      INSERT INTO channel_notes (channel, notes_md, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (channel) DO UPDATE SET notes_md = EXCLUDED.notes_md, updated_at = CURRENT_TIMESTAMP
    `, [channel, notes_md ?? '']);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Cut-level analysis endpoints (admin)
// ──────────────────────────────────────────────────────────────────────────

// POST /api/competitor-analysis/videos/:id/analyze-cuts
// Runs Gemini cut-level analysis on ONE video. Synchronous (typically 15-60s).
competitorAnalysisRouter.post('/videos/:id/analyze-cuts', async (req: Request, res: Response) => {
  try {
    const videoId = parseInt(req.params.id, 10);
    if (!videoId) return res.status(400).json({ error: 'Invalid video id' });
    const model = typeof req.body?.model === 'string' ? req.body.model : undefined;
    const result = await ingestOneVideo(getPool(), videoId, { model });
    invalidateCutCache();
    res.json(result);
  } catch (e: any) {
    logger.error('analyze-cuts failed', { videoId: req.params.id, error: e?.message });
    res.status(500).json({ error: e?.message || 'analysis failed' });
  }
});

// POST /api/competitor-analysis/channels/:channel/analyze-cuts
// Kicks off a background job analyzing ALL un-analyzed videos for a channel.
// Enforces the $20 AI inference cap per invocation unless ?approveOverBudget=true.
// Body optional: { model?: 'gemini-2.5-flash' | 'gemini-2.5-pro', limit?: number }
competitorAnalysisRouter.post('/channels/:channel/analyze-cuts', async (req: Request, res: Response) => {
  try {
    const { channel } = req.params;
    const model = typeof req.body?.model === 'string' ? req.body.model : 'gemini-2.5-flash';
    const limit = typeof req.body?.limit === 'number' ? Math.max(1, Math.floor(req.body.limit)) : null;
    const approveOverBudget = req.query.approveOverBudget === 'true';

    const videos = await seQuery(`
      SELECT v.id, v.duration_sec
      FROM videos v
      WHERE v.channel = $1 AND v.is_short = true AND v.gcs_path IS NOT NULL
        AND (v.cuts_status IS NULL OR v.cuts_status = 'failed')
      ORDER BY v.views DESC NULLS LAST
      ${limit ? `LIMIT ${limit}` : ''}
    `, [channel]) as Array<{ id: number; duration_sec: number | null }>;

    if (videos.length === 0) {
      return res.json({ started: false, reason: 'No unanalyzed videos for this channel.' });
    }

    const avgDur = videos.reduce((s, v) => s + (v.duration_sec || 45), 0) / videos.length;
    const estCost = estimateIngestCostUsd({
      shortCount: videos.length,
      avgDurationSec: avgDur,
      avgCutsPerShort: 45,
      model,
    });

    if (estCost > 20 && !approveOverBudget) {
      return res.status(409).json({
        error: 'Budget cap',
        estimated_cost_usd: Number(estCost.toFixed(2)),
        cap_usd: 20,
        hint: 'Pass ?approveOverBudget=true to proceed, or reduce limit/model.',
      });
    }

    // Kick off background job — do not await
    (async () => {
      let done = 0, failed = 0;
      for (const v of videos) {
        try {
          await ingestOneVideo(getPool(), v.id, { model });
          done++;
        } catch (err: any) {
          failed++;
          logger.warn('cut analysis failed in batch', { videoId: v.id, error: err?.message });
        }
      }
      invalidateCutCache();
      logger.info('channel cut analysis batch complete', { channel, done, failed });
    })().catch(err => logger.error('channel cut analysis crashed', { channel, error: err?.message }));

    res.json({
      started: true,
      total: videos.length,
      estimated_cost_usd: Number(estCost.toFixed(2)),
      model,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'analyze-cuts batch failed' });
  }
});

// GET /api/competitor-analysis/channels/:channel/cuts-progress
competitorAnalysisRouter.get('/channels/:channel/cuts-progress', async (req: Request, res: Response) => {
  try {
    const { channel } = req.params;
    const rows = await seQuery(`
      SELECT
        COUNT(*) FILTER (WHERE is_short = true AND gcs_path IS NOT NULL)::INTEGER AS total,
        COUNT(*) FILTER (WHERE cuts_status = 'done')::INTEGER AS done,
        COUNT(*) FILTER (WHERE cuts_status = 'analyzing')::INTEGER AS analyzing,
        COUNT(*) FILTER (WHERE cuts_status = 'failed')::INTEGER AS failed
      FROM videos
      WHERE channel = $1
    `, [channel]);
    const cutCountRows = await seQuery(`
      SELECT COUNT(*)::INTEGER AS cut_count
      FROM competitor_cuts c JOIN videos v ON v.id = c.video_id
      WHERE v.channel = $1
    `, [channel]);
    res.json({ ...rows[0], cut_count: cutCountRows[0]?.cut_count ?? 0 });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

// GET /api/competitor-analysis/diagnose
// Admin-only probe of container tools used by ingestion: yt-dlp, ffmpeg, ffprobe.
// Returns their versions + a harmless test run to help diagnose container issues.
competitorAnalysisRouter.get('/diagnose', async (req: Request, res: Response) => {
  try {
    const [ytVer, ffVer, ffpVer, ytFormats, lsBin, which, fileType, headFile] = await Promise.all([
      probeBin('/usr/local/bin/yt-dlp', ['--version']),
      probeBin('/usr/bin/ffmpeg', ['-version']),
      probeBin('/usr/bin/ffprobe', ['-version']),
      probeBin('/usr/local/bin/yt-dlp', ['--list-formats', '--no-playlist', '--extractor-args', 'youtube:player_client=tv_embedded,web_safari,mweb,default', 'https://www.youtube.com/shorts/-5xq38qHYC0'], 30_000),
      probeBin('/bin/ls', ['-la', '/usr/local/bin/']),
      probeBin('/usr/bin/which', ['yt-dlp']),
      probeBin('/usr/bin/file', ['/usr/local/bin/yt-dlp']),
      probeBin('/bin/sh', ['-c', 'head -c 200 /usr/local/bin/yt-dlp 2>&1; echo; echo "---SIZE---"; wc -c /usr/local/bin/yt-dlp 2>&1']),
    ]);
    res.json({
      ytdlp_version: ytVer,
      ffmpeg_version: { code: ffVer.code, signal: ffVer.signal, first_line: ffVer.stdout.split('\n')[0] },
      ffprobe_version: { code: ffpVer.code, signal: ffpVer.signal, first_line: ffpVer.stdout.split('\n')[0] },
      ytdlp_test_formats: {
        code: ytFormats.code,
        signal: ytFormats.signal,
        stdout_first_1kb: ytFormats.stdout.slice(0, 1000),
        stderr_last_1kb: ytFormats.stderr.slice(-1000),
        error: ytFormats.error,
      },
      fs_check: {
        ls_usr_local_bin: { code: lsBin.code, stdout: lsBin.stdout.slice(0, 1500), stderr: lsBin.stderr.slice(-300), error: lsBin.error },
        which_ytdlp: { code: which.code, stdout: which.stdout.trim(), stderr: which.stderr.trim(), error: which.error },
        file_ytdlp: { code: fileType.code, stdout: fileType.stdout.trim(), stderr: fileType.stderr.trim(), error: fileType.error },
        head_ytdlp: { code: headFile.code, stdout: headFile.stdout.slice(0, 800), stderr: headFile.stderr.slice(0, 200), error: headFile.error },
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

// POST /api/competitor-analysis/cuts/similar
// Body: { script_line, short_context?, k?, channel?, include_signed_urls? }
// This endpoint is also used by the SceneEditor panel (via the non-admin scenes
// router wrapper below). This copy stays admin-only for direct API exploration.
competitorAnalysisRouter.post('/cuts/similar', async (req: Request, res: Response) => {
  try {
    const {
      script_line = '',
      short_context = '',
      k = 5,
      channel,
      include_signed_urls = true,
      retrieve_multiplier = 4,
    } = req.body || {};
    if (!script_line.trim() && !short_context.trim()) {
      return res.status(400).json({ error: 'script_line or short_context required' });
    }
    const finalK = Math.min(10, Math.max(1, Math.floor(k)));
    const pool = getPool();
    const queryText = [script_line, short_context].filter(Boolean).join('. ');
    const candidates = await searchSimilarCuts(pool, {
      queryText,
      k: finalK * retrieve_multiplier,
      channel,
    });
    const ranked = await rerankCandidates({
      scriptLine: script_line,
      shortContext: short_context,
      candidates,
      finalK,
    });

    if (!include_signed_urls) return res.json({ suggestions: ranked });

    const withUrls = await Promise.all(ranked.map(async (r) => {
      const rows = await seQuery('SELECT gcs_path FROM videos WHERE id = $1', [r.competitor_video_id]);
      const gcs = rows[0]?.gcs_path;
      let signedUrl: string | null = null;
      if (gcs) {
        const base = await getCompetitorSignedUrl(gcs, 3600);
        const fragment = `#t=${(r.start_ms / 1000).toFixed(2)},${(r.end_ms / 1000).toFixed(2)}`;
        signedUrl = base + fragment;
      }
      return { ...r, signed_video_url: signedUrl };
    }));
    res.json({ suggestions: withUrls });
  } catch (e: any) {
    logger.error('cuts/similar failed', { error: e?.message });
    res.status(500).json({ error: e?.message || 'search failed' });
  }
});
