import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticateToken, requireRole } from '../middleware/auth';
import { getSignedUrlFromBucket } from '../services/gcpStorage';

export const competitorAnalysisRouter = Router();

competitorAnalysisRouter.use(authenticateToken);
competitorAnalysisRouter.use(requireRole('admin'));

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

async function getCompetitorSignedUrl(gcsPath: string, expiresIn = 3600): Promise<string> {
  const { bucket: bucketName, path: filePath } = extractBucketPath(gcsPath);
  return getSignedUrlFromBucket(bucketName, filePath, expiresIn);
}

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
}

ensureTable().catch(console.error);

// GET /api/competitor-analysis/channels
// Returns per-channel stats with rich video metrics
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
      SELECT * FROM stats ORDER BY avg_views DESC
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/competitor-analysis/channels/:channel/next
// Returns a random unreviewed video for this channel to start a session
competitorAnalysisRouter.get('/channels/:channel/next', async (req: Request, res: Response) => {
  try {
    const { channel } = req.params;
    const rows = await seQuery(`
      SELECT v.id, v.title, v.published_at, v.duration_sec, v.gcs_path
      FROM videos v
      LEFT JOIN competitor_reviews cr ON cr.video_id = v.id
      WHERE v.channel = $1
        AND v.is_short = true
        AND v.gcs_path IS NOT NULL
        AND cr.id IS NULL
      ORDER BY (v.published_at >= NOW() - INTERVAL '6 months') DESC, RANDOM()
      LIMIT 1
    `, [channel]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No unreviewed videos for this channel' });
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
// Saves notes + percentile_guess (called when user clicks Reveal)
competitorAnalysisRouter.post('/videos/:id/review', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes, percentile_guess, rating } = req.body;

    await seQuery(`
      INSERT INTO competitor_reviews (video_id, notes, percentile_guess, rating, reviewed_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (video_id) DO UPDATE SET
        notes = EXCLUDED.notes,
        percentile_guess = EXCLUDED.percentile_guess,
        rating = COALESCE(EXCLUDED.rating, competitor_reviews.rating),
        reviewed_at = CURRENT_TIMESTAMP
    `, [parseInt(id), notes || null, percentile_guess ?? null, rating ?? null]);

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
      seQuery('SELECT notes, percentile_guess, rating FROM competitor_reviews WHERE video_id = $1', [parseInt(id)]),
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
