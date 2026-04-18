/**
 * Channel ingestion service — fetches YouTube metadata + downloads videos to GCS.
 * Runs as a background async job, tracks progress in the script_engine DB.
 *
 * Phase 1: YouTube API → script_engine.videos (metadata + transcripts)
 * Phase 2: yt-dlp → ffmpeg → GCS (video files, H.264)
 */

import { google } from 'googleapis';
import { Pool } from 'pg';
import { getStorage } from './gcpStorage';
import { spawn } from 'child_process';
import { createReadStream, unlink as unlinkCb, mkdtempSync, renameSync } from 'fs';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import he from 'he';
import { logger } from '../utils/logger';

const unlink = promisify(unlinkCb);

const SCRIPT_ENGINE_BUCKET = process.env.SCRIPT_ENGINE_GCS_BUCKET || 'knavishmantis-script-engine';
const YTDLP_PATH = process.env.YTDLP_PATH || '/usr/local/bin/yt-dlp';
const FFPROBE_PATH = process.env.FFPROBE_PATH || '/usr/bin/ffprobe';
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg';

// ── DB pool ───────────────────────────────────────────────────────────────────

function makePool(): Pool {
  const mainDbUrl = process.env.DATABASE_URL || '';
  const host = mainDbUrl.match(/@([^:]+):/)?.[1] || '34.58.157.140';
  return new Pool({
    host, port: 5432,
    database: 'script_engine', user: 'script_engine',
    password: process.env.SCRIPT_ENGINE_DB_PASSWORD || 'MC@w@W_J:1?K{pUi(ht8mh)sUh4MzVfX',
    max: 5,
  });
}

// ── Table init ────────────────────────────────────────────────────────────────

export async function ensureIngestionTables(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ingestion_jobs (
      id           SERIAL PRIMARY KEY,
      channel      TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'running',
      phase        TEXT NOT NULL DEFAULT 'starting',
      total_videos INT  NOT NULL DEFAULT 0,
      done_videos  INT  NOT NULL DEFAULT 0,
      fail_videos  INT  NOT NULL DEFAULT 0,
      message      TEXT,
      started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS channel_meta (
      channel        TEXT PRIMARY KEY,
      display_name   TEXT NOT NULL,
      mc_username    TEXT NOT NULL,
      youtube_handle TEXT NOT NULL
    )
  `);
}

// ── Job helpers ───────────────────────────────────────────────────────────────

async function setJob(pool: Pool, jobId: number, fields: Record<string, any>): Promise<void> {
  const sets = ['updated_at = NOW()'];
  const vals: any[] = [jobId];
  let i = 2;
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k} = $${i++}`);
    vals.push(v);
  }
  await pool.query(`UPDATE ingestion_jobs SET ${sets.join(', ')} WHERE id = $1`, vals);
}

// ── YouTube helpers ───────────────────────────────────────────────────────────

function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0');
}

async function resolveChannelId(youtube: any, handle: string): Promise<string | null> {
  const clean = handle.replace(/^@/, '');
  try {
    const r = await youtube.channels.list({ part: ['id'], forHandle: clean, auth: process.env.YOUTUBE_API_KEY } as any);
    if (r.data.items?.[0]?.id) return r.data.items[0].id;
  } catch {}
  try {
    const r = await youtube.search.list({ part: ['snippet'], q: handle, type: ['channel'], maxResults: 1, auth: process.env.YOUTUBE_API_KEY } as any);
    return r.data.items?.[0]?.snippet?.channelId || null;
  } catch {}
  return null;
}

async function fetchTranscript(videoId: string): Promise<string | null> {
  try {
    const { YouTubeTranscriptApi } = await import('@playzone/youtube-transcript/dist/api');
    const api = new YouTubeTranscriptApi();
    const data = await Promise.race([
      api.fetch(videoId),
      new Promise<null>((_, rej) => setTimeout(() => rej(new Error('transcript timeout')), 12000)),
    ]);
    if (!data?.snippets?.length) return null;
    return he.decode(
      data.snippets.map((s: any) => s.text).join(' ').replace(/\s+/g, ' ').trim()
    );
  } catch {
    return null;
  }
}

// ── Video download + transcode ────────────────────────────────────────────────

function run(bin: string, args: string[], timeoutMs: number, captureLabel?: string): Promise<boolean> {
  return new Promise(resolve => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    let stdout = '';
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); if (stderr.length > 4000) stderr = stderr.slice(-4000); });
    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); if (stdout.length > 2000) stdout = stdout.slice(-2000); });
    const timer = setTimeout(() => { proc.kill('SIGKILL'); resolve(false); }, timeoutMs);
    proc.on('error', (err) => {
      clearTimeout(timer);
      if (captureLabel) logger.warn(`${captureLabel} spawn failed`, { bin, error: err.message });
      resolve(false);
    });
    proc.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code !== 0 && captureLabel) {
        logger.warn(`${captureLabel} exit code=${code} signal=${signal}`, {
          bin,
          stderr: stderr.slice(-800) || '(empty)',
          stdout: stdout.slice(-400) || '(empty)',
        });
      }
      resolve(code === 0);
    });
  });
}

// Debug helper — runs a binary with simple args, returns captured stdout/stderr/code
export async function probeBin(bin: string, args: string[], timeoutMs = 10_000): Promise<{ code: number | null; signal: string | null; stdout: string; stderr: string; error?: string }> {
  return new Promise(resolve => {
    let stderr = '', stdout = '';
    let err: string | undefined;
    try {
      const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
      const timer = setTimeout(() => { proc.kill('SIGKILL'); }, timeoutMs);
      proc.on('error', (e) => { err = e.message; clearTimeout(timer); resolve({ code: null, signal: null, stdout, stderr, error: err }); });
      proc.on('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, stdout, stderr }); });
    } catch (e: any) {
      resolve({ code: null, signal: null, stdout: '', stderr: '', error: e?.message || String(e) });
    }
  });
}

async function getCodec(filePath: string): Promise<string | null> {
  return new Promise(resolve => {
    let out = '';
    const proc = spawn(FFPROBE_PATH, [
      '-v', 'quiet', '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', filePath,
    ]);
    proc.stdout?.on('data', (d: Buffer) => { out += d.toString(); });
    proc.on('close', () => resolve(out.trim() || null));
    proc.on('error', () => resolve(null));
  });
}

async function downloadAndPrepare(videoId: string, tmpDir: string): Promise<string | null> {
  const rawPath = join(tmpDir, `${videoId}_raw.mp4`);
  const h264Path = join(tmpDir, `${videoId}.mp4`);

  // Download — try multiple player clients to bypass YouTube's "Sign in to
  // confirm you're not a bot" block on server IPs. tv_embedded + web_safari
  // are the most reliable cookie-free bypasses as of 2026-Q1.
  const ytdlpArgs = [
    '-f', 'bestvideo[height<=1080]+bestaudio/best/best',
    '--merge-output-format', 'mp4',
    '--no-playlist', '--no-progress',
    '--extractor-args', 'youtube:player_client=tv_embedded,web_safari,mweb,default',
    '-o', rawPath,
  ];
  if (process.env.YTDLP_COOKIES_FILE) ytdlpArgs.push('--cookies', process.env.YTDLP_COOKIES_FILE);
  ytdlpArgs.push(`https://www.youtube.com/shorts/${videoId}`);

  const ok = await run(YTDLP_PATH, ytdlpArgs, 8 * 60 * 1000, `yt-dlp[${videoId}]`);

  if (!ok) return null;

  // Check codec — transcode to H.264 if needed (iOS Safari compatibility)
  const codec = await getCodec(rawPath);
  if (codec === 'h264') {
    renameSync(rawPath, h264Path);
  } else {
    const transcoded = await run(FFMPEG_PATH, [
      '-y', '-i', rawPath,
      '-c:v', 'libx264', '-crf', '23', '-preset', 'fast',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      '-loglevel', 'error',
      h264Path,
    ], 10 * 60 * 1000); // 10-minute transcode timeout
    unlinkCb(rawPath, () => {});
    if (!transcoded) return null;
  }

  return h264Path;
}

async function uploadToGcs(localPath: string, gcsPath: string): Promise<boolean> {
  try {
    const storage = getStorage();
    const file = storage.bucket(SCRIPT_ENGINE_BUCKET).file(gcsPath);
    await new Promise<void>((resolve, reject) => {
      const ws = file.createWriteStream({ contentType: 'video/mp4', resumable: true });
      createReadStream(localPath).pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
    });
    return true;
  } catch (err: any) {
    logger.error('GCS upload failed', { gcsPath, error: err.message });
    return false;
  }
}

// ── Main job ──────────────────────────────────────────────────────────────────

async function runJob(jobId: number, channel: string, youtubeHandle: string): Promise<void> {
  const pool = makePool();
  const youtube = google.youtube('v3');
  const apiKey = process.env.YOUTUBE_API_KEY;

  try {
    // ── Resolve channel ──
    await setJob(pool, jobId, { phase: 'resolving_channel' });
    const channelId = await resolveChannelId(youtube, youtubeHandle);
    if (!channelId) {
      await setJob(pool, jobId, { status: 'error', message: `Could not resolve channel ID for ${youtubeHandle}` });
      return;
    }

    // ── Fetch uploads playlist ──
    await setJob(pool, jobId, { phase: 'fetching_video_list' });
    const uploadsRes: any = await (youtube.channels.list as any)({
      part: ['contentDetails'], id: [channelId], auth: apiKey,
    });
    const playlistId = uploadsRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!playlistId) {
      await setJob(pool, jobId, { status: 'error', message: 'Could not get uploads playlist' });
      return;
    }

    // Collect all video IDs
    const videoIds: string[] = [];
    let pageToken: string | undefined;
    do {
      const res: any = await (youtube.playlistItems.list as any)({
        part: ['contentDetails'], playlistId, maxResults: 50, pageToken, auth: apiKey,
      });
      for (const item of res.data.items || []) {
        if (item.contentDetails?.videoId) videoIds.push(item.contentDetails.videoId);
      }
      pageToken = res.data.nextPageToken;
      await new Promise(r => setTimeout(r, 100));
    } while (pageToken);

    // ── Fetch metadata + upsert ──
    await setJob(pool, jobId, { phase: 'fetching_metadata' });
    let totalShorts = 0;
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50);
      const res: any = await (youtube.videos.list as any)({
        part: ['snippet', 'statistics', 'contentDetails'], id: batch, auth: apiKey,
      });
      for (const v of res.data.items || []) {
        const durSec = parseDuration(v.contentDetails?.duration || '');
        const isShort = durSec <= 180;
        if (isShort) totalShorts++;
        const stats = v.statistics || {};
        await pool.query(`
          INSERT INTO videos (channel, video_id, title, views, likes, comments, duration_sec, published_at, is_short)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (video_id) DO UPDATE SET
            views = EXCLUDED.views, likes = EXCLUDED.likes, comments = EXCLUDED.comments,
            title = EXCLUDED.title, fetched_at = NOW()
        `, [
          channel, v.id, v.snippet?.title || '',
          parseInt(stats.viewCount || '0', 10),
          parseInt(stats.likeCount || '0', 10),
          parseInt(stats.commentCount || '0', 10),
          durSec,
          v.snippet?.publishedAt ? new Date(v.snippet.publishedAt) : null,
          isShort,
        ]);
      }
      await new Promise(r => setTimeout(r, 100));
    }
    await setJob(pool, jobId, { total_videos: totalShorts });

    // ── Fetch transcripts ──
    // Scraper-based; unreliable when YouTube changes its internal HTML. If the
    // first several calls fail in a row, skip the rest of the phase rather than
    // stalling the whole job. Transcripts are optional downstream (Gemini
    // extracts per-cut narration from the video directly).
    await setJob(pool, jobId, { phase: 'fetching_transcripts' });
    const { rows: noTranscript } = await pool.query(
      `SELECT video_id FROM videos WHERE channel = $1 AND is_short = true AND auto_captions IS NULL`,
      [channel]
    );
    let consecutiveFailures = 0;
    const ABORT_AFTER_FAILURES = 5;
    let transcriptsFetched = 0;
    for (const { video_id } of noTranscript) {
      const t = await fetchTranscript(video_id);
      if (t) {
        await pool.query(`UPDATE videos SET auto_captions = $1 WHERE video_id = $2`, [t, video_id]);
        transcriptsFetched++;
        consecutiveFailures = 0;
      } else {
        consecutiveFailures++;
        if (consecutiveFailures >= ABORT_AFTER_FAILURES) {
          logger.warn('Transcript fetching aborted — scraper unreliable, proceeding to downloads', {
            channel, attempted: transcriptsFetched + consecutiveFailures, fetched: transcriptsFetched,
          });
          break;
        }
      }
      await new Promise(r => setTimeout(r, 2000)); // Rate limit
    }

    // ── Download + upload videos ──
    await setJob(pool, jobId, { phase: 'downloading' });
    const { rows: toDownload } = await pool.query(
      `SELECT video_id FROM videos WHERE channel = $1 AND is_short = true AND gcs_path IS NULL ORDER BY views DESC`,
      [channel]
    );

    let done = 0, failed = 0;
    const channelSlug = channel.toLowerCase().replace(/\s+/g, '_');

    // Process 2 at a time to keep temp disk usage low
    const queue = toDownload.map((r: any) => r.video_id);
    while (queue.length > 0) {
      const batch = queue.splice(0, 2);
      await Promise.all(batch.map(async (videoId: string) => {
        const tmpDir = mkdtempSync(join(tmpdir(), 'ingest-'));
        try {
          const localPath = await downloadAndPrepare(videoId, tmpDir);
          if (!localPath) { failed++; return; }

          const gcsPath = `videos/${channelSlug}/${videoId}.mp4`;
          const uploaded = await uploadToGcs(localPath, gcsPath);
          unlinkCb(localPath, () => {});

          if (!uploaded) { failed++; return; }

          await pool.query(`UPDATE videos SET gcs_path = $1 WHERE video_id = $2`, [gcsPath, videoId]);
          done++;
        } catch (err: any) {
          logger.error('Video ingest failed', { videoId, error: err.message });
          failed++;
        }
        await setJob(pool, jobId, { done_videos: done, fail_videos: failed });
      }));
    }

    await setJob(pool, jobId, {
      status: 'done', phase: 'complete',
      done_videos: done, fail_videos: failed,
      message: `${done} videos ingested${failed ? `, ${failed} failed` : ''}. ${noTranscript.length} transcripts fetched.`,
    });

  } catch (err: any) {
    logger.error('Ingestion job failed', { jobId, channel, error: err.message });
    await setJob(pool, jobId, { status: 'error', message: err.message }).catch(() => {});
  } finally {
    pool.end();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function startIngestion(
  channel: string,
  youtubeHandle: string,
  displayName: string,
  mcUsername: string,
): Promise<number> {
  const pool = makePool();
  try {
    await ensureIngestionTables(pool);

    // Upsert channel meta
    await pool.query(`
      INSERT INTO channel_meta (channel, display_name, mc_username, youtube_handle)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (channel) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        mc_username = EXCLUDED.mc_username,
        youtube_handle = EXCLUDED.youtube_handle
    `, [channel, displayName, mcUsername, youtubeHandle]);

    // Create job
    const { rows } = await pool.query(`
      INSERT INTO ingestion_jobs (channel, status, phase, total_videos, done_videos, fail_videos, started_at, updated_at)
      VALUES ($1, 'running', 'starting', 0, 0, 0, NOW(), NOW())
      RETURNING id
    `, [channel]);
    const jobId = rows[0].id;

    // Fire background job (creates its own pool)
    runJob(jobId, channel, youtubeHandle).catch(err =>
      logger.error('Uncaught ingestion job error', { jobId, error: err.message })
    );

    return jobId;
  } finally {
    pool.end();
  }
}

export async function getIngestionStatus(channel: string): Promise<any | null> {
  const pool = makePool();
  try {
    const { rows } = await pool.query(
      `SELECT * FROM ingestion_jobs WHERE channel = $1 ORDER BY id DESC LIMIT 1`,
      [channel]
    );
    return rows[0] || null;
  } finally {
    pool.end();
  }
}

export async function getAllChannelMeta(pool: Pool): Promise<any[]> {
  try {
    await ensureIngestionTables(pool);
    const { rows } = await pool.query(`SELECT * FROM channel_meta`);
    return rows;
  } catch {
    return [];
  }
}
