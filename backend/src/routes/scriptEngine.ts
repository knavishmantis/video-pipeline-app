import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticateToken, requireRole } from '../middleware/auth';
import { getSignedUrlFromBucket } from '../services/gcpStorage';

const SE_BUCKET = 'knavishmantis-script-engine';

export const scriptEngineRouter = Router();

scriptEngineRouter.use(authenticateToken);
scriptEngineRouter.use(requireRole('admin'));

// Separate connection pool for script_engine database
let sePool: Pool | null = null;

function getPool(): Pool {
  if (!sePool) {
    const mainDbUrl = process.env.DATABASE_URL || '';
    // Same host, different database
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

// GET /api/script-engine/status — overview dashboard data
scriptEngineRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    // Run ALL queries in parallel
    const [runs, ideaStats, ideaSources, recentIdeas, briefStatsRows, recentBriefs, videoStatsRows, bugCount, redditCount, modCount, versionCount, wikiCount, scriptStatsRows, critiqueStatsRows] = await Promise.all([
      seQuery(`SELECT id, status, total_ideas, duplicates_removed, errors_count, started_at, completed_at, EXTRACT(EPOCH FROM (completed_at - started_at))::INTEGER as duration_sec FROM runs ORDER BY id DESC LIMIT 10`),
      seQuery(`SELECT status, COUNT(*)::INTEGER as count FROM ideas GROUP BY status ORDER BY count DESC`),
      seQuery(`SELECT source, COUNT(*)::INTEGER as count FROM ideas GROUP BY source ORDER BY count DESC`),
      seQuery(`SELECT id, source, title, status, confidence, created_at FROM ideas ORDER BY id DESC LIMIT 15`),
      seQuery(`SELECT COUNT(*)::INTEGER as total, COUNT(*) FILTER (WHERE verdict = 'validated' OR verdict = 'greenlight' OR verdict = 'confirmed' OR verdict = 'approved')::INTEGER as validated, COUNT(*) FILTER (WHERE verdict = 'rejected')::INTEGER as rejected FROM research_briefs`),
      seQuery(`SELECT rb.id, rb.idea_id, rb.verdict, rb.verdict_reason, rb.rating, rb.completed_at, rb.created_at, i.title, i.source FROM research_briefs rb JOIN ideas i ON rb.idea_id = i.id ORDER BY rb.created_at DESC LIMIT 10`),
      seQuery(`SELECT COUNT(*)::INTEGER as total, COUNT(*) FILTER (WHERE is_short)::INTEGER as shorts, COUNT(*) FILTER (WHERE auto_captions IS NOT NULL AND is_short)::INTEGER as captions, COUNT(*) FILTER (WHERE gcs_path IS NOT NULL AND is_short)::INTEGER as in_gcs FROM videos WHERE channel IN ('camman18', 'DashPum4', 'Skip the Tutorial', 'TurbaneMC', 'BentReal', 'Mogswamp', 'fWhip')`),
      seQuery('SELECT COUNT(*)::INTEGER as c FROM bugs'),
      seQuery('SELECT COUNT(*)::INTEGER as c FROM reddit_posts'),
      seQuery('SELECT COUNT(*)::INTEGER as c FROM mods'),
      seQuery('SELECT COUNT(*)::INTEGER as c FROM mc_versions'),
      seQuery('SELECT COUNT(*)::INTEGER as c FROM wiki_pages'),
      seQuery(`SELECT COUNT(*)::INTEGER as total, COUNT(*) FILTER (WHERE status = 'approved')::INTEGER as approved, COUNT(*) FILTER (WHERE status = 'draft')::INTEGER as draft, COUNT(*) FILTER (WHERE status = 'needs_review')::INTEGER as needs_review FROM scripts WHERE status != 'superseded'`),
      seQuery(`SELECT COUNT(*)::INTEGER as total, COUNT(*) FILTER (WHERE decision = 'approved')::INTEGER as approved, COUNT(*) FILTER (WHERE decision = 'rewrite')::INTEGER as rewrites, ROUND(AVG(score_overall), 1)::FLOAT as avg_score FROM script_critiques`),
    ]);

    // Steps for latest run (depends on runs result)
    const latestRunId = runs[0]?.id;
    const steps = latestRunId ? await seQuery(`SELECT agent, status, items_processed, ideas_generated, errors, started_at, completed_at, EXTRACT(EPOCH FROM (completed_at - started_at))::INTEGER as duration_sec FROM run_steps WHERE run_id = $1 ORDER BY agent`, [latestRunId]) : [];

    const videoStats = videoStatsRows;
    const briefStats = briefStatsRows;
    const dataCounts = {
      bugs: bugCount[0]?.c || 0,
      reddit: redditCount[0]?.c || 0,
      mods: modCount[0]?.c || 0,
      versions: versionCount[0]?.c || 0,
      wiki: wikiCount[0]?.c || 0,
    };

    res.json({
      runs,
      latestSteps: steps,
      ideaStats,
      ideaSources,
      recentIdeas,
      briefStats: briefStats[0] || {},
      scriptStats: scriptStatsRows[0] || {},
      critiqueStats: critiqueStatsRows[0] || {},
      recentBriefs,
      videoStats: videoStats[0] || {},
      dataCounts,
    });
  } catch (error: any) {
    console.error('Script engine status error:', error);
    res.status(500).json({ error: 'Failed to fetch script engine status' });
  }
});

// GET /api/script-engine/ideas — list all ideas with filters
scriptEngineRouter.get('/ideas', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    let sql = 'SELECT id, source, title, hook, angle, status, confidence, created_at FROM ideas';
    const params: any[] = [];
    if (status) {
      sql += ' WHERE status = $1';
      params.push(status);
    }
    sql += ' ORDER BY id DESC';
    const ideas = await seQuery(sql, params);
    res.json(ideas);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch ideas' });
  }
});

// GET /api/script-engine/ideas/search — search ideas for linking briefs to existing shorts.
// Fuzzy: splits the query into tokens and requires each token to appear in
// one of title / hook / angle / brief.summary / brief.full_brief. Ranks by
// number of fields that matched + whether the title matched.
// Must be before /ideas/:id to avoid Express matching "search" as an id.
scriptEngineRouter.get('/ideas/search', async (req: Request, res: Response) => {
  try {
    const raw = (req.query.q as string || '').trim();
    // Tokenize on whitespace; drop stopwords-free since Minecraft nouns are the signal.
    const tokens = raw.split(/\s+/).filter(t => t.length >= 2);

    let sql = `
      SELECT i.id, i.title, i.source, i.status, i.hook, i.angle,
        rb.full_brief, rb.rating, rb.summary as brief_summary,
        (
          (CASE WHEN i.title ILIKE '%' || $1 || '%' THEN 3 ELSE 0 END) +
          (CASE WHEN i.hook  ILIKE '%' || $1 || '%' THEN 2 ELSE 0 END) +
          (CASE WHEN rb.summary ILIKE '%' || $1 || '%' THEN 1 ELSE 0 END) +
          (CASE WHEN rb.full_brief ILIKE '%' || $1 || '%' THEN 1 ELSE 0 END)
        ) AS score
      FROM ideas i
      LEFT JOIN research_briefs rb ON rb.id = (
        SELECT MAX(rb2.id) FROM research_briefs rb2
        WHERE rb2.idea_id = i.id AND rb2.verdict != 'rejected'
      )
      WHERE rb.full_brief IS NOT NULL
    `;
    const params: any[] = [raw || '']; // $1 used for scoring

    // Per-token AND filter — each token must appear somewhere in the record.
    tokens.forEach((t, idx) => {
      const i = idx + 2; // $2, $3, ...
      sql += ` AND (i.title ILIKE $${i} OR i.hook ILIKE $${i} OR COALESCE(i.angle, '') ILIKE $${i}
               OR COALESCE(rb.summary, '') ILIKE $${i} OR COALESCE(rb.full_brief, '') ILIKE $${i})`;
      params.push(`%${t}%`);
    });

    // When no query, just list recent.
    sql += tokens.length
      ? ` ORDER BY score DESC, rb.rating DESC NULLS LAST, i.id DESC LIMIT 50`
      : ` ORDER BY rb.rating DESC NULLS LAST, i.id DESC LIMIT 50`;

    const rows = await seQuery(sql, params);
    res.json(rows);
  } catch (error: any) {
    console.error('ideas/search failed:', error.message);
    res.status(500).json({ error: 'Failed to search ideas' });
  }
});

// GET /api/script-engine/ideas/:id — single idea with research brief
scriptEngineRouter.get('/ideas/:id', async (req: Request, res: Response) => {
  try {
    const idea = await seQuery('SELECT * FROM ideas WHERE id = $1', [req.params.id]);
    if (!idea.length) return res.status(404).json({ error: 'Idea not found' });

    const brief = await seQuery('SELECT * FROM research_briefs WHERE idea_id = $1', [req.params.id]);

    res.json({ idea: idea[0], brief: brief[0] || null });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch idea' });
  }
});

// GET /api/script-engine/briefs — research briefs, filterable by human_status.
// Default (no ?human_status) returns ALL; pass 'unreviewed' / 'created' / 'skipped'
// to filter for the Backlog tabs. Verdict-rejected briefs excluded from the
// Unreviewed tab so reviewers don't waste time on dead-ends.
scriptEngineRouter.get('/briefs', async (req: Request, res: Response) => {
  try {
    const humanStatus = req.query.human_status as string;
    const source = req.query.source as string;
    const angle = req.query.angle as string;
    const q = (req.query.q as string || '').trim();
    const minRating = req.query.min_rating ? parseInt(req.query.min_rating as string, 10) : null;

    let sql = `
      SELECT rb.id, rb.idea_id, rb.verdict, rb.verdict_reason, rb.rating, rb.completed_at,
        rb.created_at, rb.human_status, rb.summary,
        i.title, i.source, i.hook, i.angle, i.is_time_sensitive
      FROM research_briefs rb JOIN ideas i ON rb.idea_id = i.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let p = 1;
    if (humanStatus === 'unreviewed') {
      sql += ` AND rb.human_status IS NULL AND rb.verdict != 'rejected'`;
    } else if (humanStatus === 'created' || humanStatus === 'skipped' || humanStatus === 'starred') {
      sql += ` AND rb.human_status = $${p++}`;
      params.push(humanStatus);
    }
    if (source) {
      sql += ` AND i.source = $${p++}`;
      params.push(source);
    }
    if (angle) {
      sql += ` AND i.angle = $${p++}`;
      params.push(angle);
    }
    if (minRating !== null && !Number.isNaN(minRating)) {
      sql += ` AND rb.rating >= $${p++}`;
      params.push(minRating);
    }
    if (q) {
      // Case-insensitive match against title, summary, AND full_brief so the
      // search covers the whole brief body, not just the top.
      sql += ` AND (i.title ILIKE $${p} OR rb.summary ILIKE $${p} OR rb.full_brief ILIKE $${p})`;
      params.push(`%${q}%`);
      p++;
    }
    sql += ` ORDER BY rb.rating DESC NULLS LAST, rb.created_at DESC`;
    const briefs = await seQuery(sql, params);
    res.json(briefs);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch briefs' });
  }
});

// GET /api/script-engine/briefs/counts — tab counts for Backlog header
scriptEngineRouter.get('/briefs/counts', async (_req: Request, res: Response) => {
  try {
    const rows = await seQuery(`
      SELECT
        COUNT(*) FILTER (WHERE rb.human_status IS NULL AND rb.verdict != 'rejected')::INTEGER AS unreviewed,
        COUNT(*) FILTER (WHERE rb.human_status = 'starred')::INTEGER AS starred,
        COUNT(*) FILTER (WHERE rb.human_status = 'created')::INTEGER AS created,
        COUNT(*) FILTER (WHERE rb.human_status = 'skipped')::INTEGER AS skipped,
        COUNT(*)::INTEGER AS total,
        ROUND(AVG(rb.rating) FILTER (WHERE rb.human_status IS NULL AND rb.verdict != 'rejected'), 1)::FLOAT AS avg_rating_unreviewed,
        COUNT(*) FILTER (WHERE rb.human_status IS NULL AND rb.verdict != 'rejected' AND rb.rating >= 8)::INTEGER AS high_unreviewed,
        COUNT(*) FILTER (WHERE rb.human_status IS NULL AND rb.verdict != 'rejected' AND rb.rating BETWEEN 6 AND 7)::INTEGER AS mid_unreviewed,
        COUNT(*) FILTER (WHERE rb.human_status IS NULL AND rb.verdict != 'rejected' AND (rb.rating < 6 OR rb.rating IS NULL))::INTEGER AS low_unreviewed
      FROM research_briefs rb
    `);
    res.json(rows[0] || { unreviewed: 0, starred: 0, created: 0, skipped: 0, total: 0, avg_rating_unreviewed: 0, high_unreviewed: 0, mid_unreviewed: 0, low_unreviewed: 0 });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch brief counts' });
  }
});

// GET /api/script-engine/briefs/:id — single brief with full detail for review pane
scriptEngineRouter.get('/briefs/:id', async (req: Request, res: Response) => {
  try {
    const rows = await seQuery(`
      SELECT rb.*, i.title, i.source, i.hook, i.angle, i.content_points,
        i.why_surprising, i.why_fits_km, i.confidence, i.is_time_sensitive,
        i.status AS idea_status, i.source_video_id
      FROM research_briefs rb
      JOIN ideas i ON rb.idea_id = i.id
      WHERE rb.id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Brief not found' });
    res.json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch brief' });
  }
});

// PATCH /api/script-engine/briefs/:id/mark — set human_status ('created' | 'skipped' | null)
scriptEngineRouter.patch('/briefs/:id/mark', async (req: Request, res: Response) => {
  try {
    const { human_status } = req.body;
    if (human_status !== 'created' && human_status !== 'skipped' && human_status !== 'starred' && human_status !== null) {
      return res.status(400).json({ error: 'human_status must be "created", "skipped", "starred", or null' });
    }
    await seQuery('UPDATE research_briefs SET human_status = $1 WHERE id = $2', [human_status, req.params.id]);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to mark brief' });
  }
});

// GET /api/script-engine/scripts — all generated scripts with idea title
scriptEngineRouter.get('/scripts', async (_req: Request, res: Response) => {
  try {
    const scripts = await seQuery(`
      SELECT s.id, s.idea_id, s.draft_number, s.word_count, s.model_used, s.status, s.created_at,
        i.title, i.source, i.hook
      FROM scripts s
      JOIN ideas i ON s.idea_id = i.id
      WHERE s.status != 'superseded'
      ORDER BY s.created_at DESC
    `);
    res.json(scripts);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch scripts' });
  }
});

// GET /api/script-engine/scripts/:id — single script with full text
scriptEngineRouter.get('/scripts/:id', async (req: Request, res: Response) => {
  try {
    const scripts = await seQuery(`
      SELECT s.*, i.title, i.source, i.hook, i.angle, i.content_points
      FROM scripts s JOIN ideas i ON s.idea_id = i.id
      WHERE s.id = $1
    `, [req.params.id]);
    if (!scripts.length) return res.status(404).json({ error: 'Script not found' });
    res.json(scripts[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch script' });
  }
});

// PATCH /api/script-engine/scripts/:id/status — update script status (draft → approved / rejected)
scriptEngineRouter.patch('/scripts/:id/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    // 'needs_review' retained for legacy archive rows (critic agent retired 2026-04-16)
    // but cannot be *set* via the API going forward.
    if (!['draft', 'approved', 'rejected', 'superseded'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    await seQuery('UPDATE scripts SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update script status' });
  }
});

// GET /api/script-engine/scripts/:id/critiques — critique history for a script
scriptEngineRouter.get('/scripts/:id/critiques', async (req: Request, res: Response) => {
  try {
    const critiques = await seQuery(`
      SELECT sc.*, s.draft_number, s.word_count
      FROM script_critiques sc
      JOIN scripts s ON sc.script_id = s.id
      WHERE sc.script_id = $1
      ORDER BY sc.created_at DESC
    `, [req.params.id]);
    res.json(critiques);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch critiques' });
  }
});

// GET /api/script-engine/ideas/:id/critiques — all critique history for an idea (all drafts)
scriptEngineRouter.get('/ideas/:id/critiques', async (req: Request, res: Response) => {
  try {
    const critiques = await seQuery(`
      SELECT sc.id, sc.script_id, sc.draft_number,
        sc.score_hook, sc.score_pivot, sc.score_pacing, sc.score_density,
        sc.score_voice, sc.score_ending, sc.score_accuracy, sc.score_competitive, sc.score_overall,
        sc.decision, sc.critique, sc.rewrite_guidance, sc.created_at
      FROM script_critiques sc
      WHERE sc.idea_id = $1
      ORDER BY sc.draft_number ASC
    `, [req.params.id]);
    res.json(critiques);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch critiques' });
  }
});

// GET /api/script-engine/critiques — all critiques with scores, script text, idea info (for review page)
scriptEngineRouter.get('/critiques', async (req: Request, res: Response) => {
  try {
    const decision = req.query.decision as string;
    const humanStatus = req.query.human_status as string; // 'used' | 'not_used' | 'unmarked' | omit for default (unmarked only)
    // Only show the LATEST critique per idea (highest sc.id per idea_id)
    let sql = `
      SELECT sc.id, sc.script_id, sc.idea_id, sc.draft_number,
        sc.score_hook, sc.score_pivot, sc.score_pacing, sc.score_density,
        sc.score_voice, sc.score_ending, sc.score_accuracy, sc.score_competitive, sc.score_overall,
        sc.decision, sc.critique, sc.rewrite_guidance, sc.created_at, sc.human_status,
        s.script_text, s.word_count, s.model_used, s.status as script_status,
        i.title, i.source, i.hook, i.angle, i.status as idea_status,
        rb.full_brief, rb.summary as brief_summary
      FROM script_critiques sc
      JOIN scripts s ON sc.script_id = s.id
      JOIN ideas i ON sc.idea_id = i.id
      LEFT JOIN research_briefs rb ON rb.id = (SELECT MAX(rb2.id) FROM research_briefs rb2 WHERE rb2.idea_id = i.id AND rb2.verdict != 'rejected')
      WHERE sc.id = (
        SELECT MAX(sc2.id) FROM script_critiques sc2 WHERE sc2.idea_id = sc.idea_id
      )
    `;
    const params: any[] = [];
    let paramIdx = 1;
    if (decision) {
      sql += ` AND sc.decision = $${paramIdx++}`;
      params.push(decision);
    }
    if (humanStatus === 'used' || humanStatus === 'not_used') {
      sql += ` AND sc.human_status = $${paramIdx++}`;
      params.push(humanStatus);
    } else if (humanStatus === 'unmarked' || !humanStatus) {
      // Default: hide marked scripts from main view
      sql += ` AND sc.human_status IS NULL`;
    }
    // humanStatus === 'all' → no filter
    sql += ' ORDER BY sc.score_overall DESC, sc.created_at DESC';
    const critiques = await seQuery(sql, params);
    res.json(critiques);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch critiques' });
  }
});

// GET /api/script-engine/critiques/counts — tab counts + score distribution for the review page header
scriptEngineRouter.get('/critiques/counts', async (_req: Request, res: Response) => {
  try {
    const rows = await seQuery(`
      WITH latest AS (
        SELECT sc.* FROM script_critiques sc
        WHERE sc.id = (SELECT MAX(sc2.id) FROM script_critiques sc2 WHERE sc2.idea_id = sc.idea_id)
      )
      SELECT
        COUNT(*) FILTER (WHERE human_status IS NULL)::INTEGER AS unmarked,
        COUNT(*) FILTER (WHERE human_status = 'used')::INTEGER AS used,
        COUNT(*) FILTER (WHERE human_status = 'not_used')::INTEGER AS not_used,
        COUNT(*)::INTEGER AS total,
        ROUND(AVG(score_overall) FILTER (WHERE human_status IS NULL), 1)::FLOAT AS avg_score_unmarked,
        COUNT(*) FILTER (WHERE human_status IS NULL AND score_overall >= 8)::INTEGER AS high_unmarked,
        COUNT(*) FILTER (WHERE human_status IS NULL AND score_overall BETWEEN 6 AND 7)::INTEGER AS mid_unmarked,
        COUNT(*) FILTER (WHERE human_status IS NULL AND score_overall < 6)::INTEGER AS low_unmarked
      FROM latest
    `);
    res.json(rows[0] || { unmarked: 0, used: 0, not_used: 0, total: 0, avg_score_unmarked: 0, high_unmarked: 0, mid_unmarked: 0, low_unmarked: 0 });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch critique counts' });
  }
});

// GET /api/script-engine/critiques/:id — single critique with full detail + draft history
scriptEngineRouter.get('/critiques/:id', async (req: Request, res: Response) => {
  try {
    const critique = await seQuery(`
      SELECT sc.*,
        s.script_text, s.word_count, s.model_used, s.status as script_status,
        i.title, i.source, i.hook, i.angle, i.content_points, i.status as idea_status,
        rb.full_brief, rb.summary as brief_summary
      FROM script_critiques sc
      JOIN scripts s ON sc.script_id = s.id
      JOIN ideas i ON sc.idea_id = i.id
      LEFT JOIN research_briefs rb ON rb.id = (SELECT MAX(rb2.id) FROM research_briefs rb2 WHERE rb2.idea_id = i.id AND rb2.verdict != 'rejected')
      WHERE sc.id = $1
    `, [req.params.id]);
    if (!critique.length) return res.status(404).json({ error: 'Critique not found' });

    // Also get all critiques for this idea (draft history)
    const history = await seQuery(`
      SELECT sc.id, sc.draft_number, sc.score_overall, sc.decision, sc.created_at
      FROM script_critiques sc WHERE sc.idea_id = $1 ORDER BY sc.draft_number ASC
    `, [critique[0].idea_id]);

    res.json({ ...critique[0], draft_history: history });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch critique' });
  }
});

// PATCH /api/script-engine/critiques/:id/approve — human approves a needs_review or any critiqued script
scriptEngineRouter.patch('/critiques/:id/approve', async (req: Request, res: Response) => {
  try {
    const critique = await seQuery('SELECT script_id, idea_id FROM script_critiques WHERE id = $1', [req.params.id]);
    if (!critique.length) return res.status(404).json({ error: 'Critique not found' });
    await seQuery('UPDATE scripts SET status = $1 WHERE id = $2', ['approved', critique[0].script_id]);
    await seQuery('UPDATE ideas SET status = $1 WHERE id = $2', ['approved', critique[0].idea_id]);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to approve' });
  }
});

// PATCH /api/script-engine/critiques/:id/reject — human rejects
scriptEngineRouter.patch('/critiques/:id/reject', async (req: Request, res: Response) => {
  try {
    const critique = await seQuery('SELECT script_id, idea_id FROM script_critiques WHERE id = $1', [req.params.id]);
    if (!critique.length) return res.status(404).json({ error: 'Critique not found' });
    await seQuery('UPDATE scripts SET status = $1 WHERE id = $2', ['rejected', critique[0].script_id]);
    await seQuery('UPDATE ideas SET status = $1 WHERE id = $2', ['rejected', critique[0].idea_id]);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to reject' });
  }
});

// POST /api/script-engine/briefs/:id/create-short — create a short directly from a research brief
// (new primary path after write/critic agents were retired 2026-04-16; see also
// /critiques/:id/create-short below, which remains for historical critique rows).
scriptEngineRouter.post('/briefs/:id/create-short', async (req: Request, res: Response) => {
  try {
    const rows = await seQuery(`
      SELECT rb.id, rb.idea_id, rb.full_brief, rb.summary, rb.rating,
        i.title, i.hook, i.angle, i.content_points
      FROM research_briefs rb
      JOIN ideas i ON rb.idea_id = i.id
      WHERE rb.id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Brief not found' });
    const b = rows[0];

    const ideaParts: string[] = [];
    if (b.hook) ideaParts.push(`Hook: ${b.hook}`);
    if (b.angle) ideaParts.push(`Angle: ${b.angle}`);
    if (b.content_points) {
      const pts = typeof b.content_points === 'string' ? b.content_points : JSON.stringify(b.content_points);
      ideaParts.push(`Content points: ${pts}`);
    }

    const { query: mainQuery } = await import('../db');
    const result = await mainQuery(
      `INSERT INTO shorts (title, idea, research_brief, status)
       VALUES ($1, $2, $3, 'script')
       RETURNING *`,
      [b.title, ideaParts.join('\n') || null, b.full_brief || b.summary || null]
    );

    // Mark the brief as 'created' so the Backlog tab tracking stays in sync.
    await seQuery(`UPDATE research_briefs SET human_status = 'created' WHERE id = $1`, [req.params.id]);

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Failed to create short from brief:', error.message);
    res.status(500).json({ error: 'Failed to create short from brief' });
  }
});

// POST /api/script-engine/critiques/:id/create-short — create a short in the main pipeline from a critique
scriptEngineRouter.post('/critiques/:id/create-short', async (req: Request, res: Response) => {
  try {
    // Fetch full critique data from script_engine DB
    const rows = await seQuery(`
      SELECT sc.id, sc.script_id, sc.idea_id,
        s.script_text,
        i.title, i.hook, i.angle, i.content_points,
        rb.full_brief
      FROM script_critiques sc
      JOIN scripts s ON sc.script_id = s.id
      JOIN ideas i ON sc.idea_id = i.id
      LEFT JOIN research_briefs rb ON rb.id = (
        SELECT MAX(rb2.id) FROM research_briefs rb2
        WHERE rb2.idea_id = i.id AND rb2.verdict != 'rejected'
      )
      WHERE sc.id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Critique not found' });

    const c = rows[0];

    // Build the idea text from hook + angle + content_points
    const ideaParts: string[] = [];
    if (c.hook) ideaParts.push(`Hook: ${c.hook}`);
    if (c.angle) ideaParts.push(`Angle: ${c.angle}`);
    if (c.content_points) {
      const pts = typeof c.content_points === 'string' ? c.content_points : JSON.stringify(c.content_points);
      ideaParts.push(`Content points: ${pts}`);
    }

    // Create short in the main app DB
    const { query: mainQuery } = await import('../db');
    const result = await mainQuery(
      `INSERT INTO shorts (title, idea, script_content, research_brief, status)
       VALUES ($1, $2, $3, $4, 'script')
       RETURNING *`,
      [c.title, ideaParts.join('\n') || null, c.script_text, c.full_brief || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Failed to create short from critique:', error.message);
    res.status(500).json({ error: 'Failed to create short from critique' });
  }
});


// GET /api/script-engine/format-references — taxonomy definition + top examples per format
const FORMAT_TAXONOMY = [
  { id: 'myth-bust',        name: 'Myth Bust',        description: 'States a widely believed claim, tests it, reveals whether it\'s true or false.', avg_views: 8882890 },
  { id: 'discovery-find',   name: 'Discovery Find',   description: 'Documents finding something rare, hidden, or obscure and explains why it matters.', avg_views: 8076783 },
  { id: 'mechanic-reveal',  name: 'Mechanic Reveal',  description: 'Introduces a counterintuitive or hidden game mechanic, demonstrates it, delivers the implication.', avg_views: 7845120 },
  { id: 'how-to',           name: 'How-To',           description: 'Addresses a player goal or problem, walks through a concrete method or strategy.', avg_views: 7743481 },
  { id: 'creator-moment',   name: 'Creator Moment',   description: 'Personal story, behind-the-scenes anecdote, or meta channel event centered on the creator.', avg_views: 7665407 },
  { id: 'hot-take',         name: 'Hot Take',         description: 'Opens with a strong opinion about game design, Mojang decisions, or player culture — argues it.', avg_views: 6856045 },
  { id: 'challenge-run',    name: 'Challenge Run',    description: 'Establishes competitive stakes (speedrun, manhunt, elimination), plays out the attempt, delivers outcome.', avg_views: 5887316 },
  { id: 'news-react',       name: 'News React',       description: 'Covers a real event — update drop, snapshot, industry news — and adds creator commentary.', avg_views: 5755780 },
  { id: 'viewer-challenge', name: 'Viewer Challenge', description: 'Poses a quiz or puzzle directly to the viewer, lets suspense build, then reveals the answer.', avg_views: 5727224 },
];

async function enrichVideosWithUrls(videos: any[]) {
  return Promise.all(videos.map(async (v) => {
    let video_url: string | null = null;
    if (v.gcs_path) {
      try {
        video_url = await getSignedUrlFromBucket(SE_BUCKET, v.gcs_path, 3600, 'video/mp4');
      } catch { /* fall through to null */ }
    }
    return {
      video_id: v.video_id,
      title: v.title,
      views: v.views,
      transcript: v.auto_captions || null,
      video_url,
    };
  }));
}

scriptEngineRouter.get('/format-references', async (_req: Request, res: Response) => {
  try {
    const formats = await Promise.all(
      FORMAT_TAXONOMY.map(async (fmt) => {
        const rows = await seQuery(
          `SELECT video_id, title, views, gcs_path, auto_captions
           FROM videos
           WHERE channel = 'camman18' AND format_id = $1
           ORDER BY views DESC LIMIT 5`,
          [fmt.id]
        );
        const top_videos = await enrichVideosWithUrls(rows);
        return { ...fmt, top_videos };
      })
    );
    res.json(formats);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch format references' });
  }
});

scriptEngineRouter.get('/format-references/:formatId', async (req: Request, res: Response) => {
  try {
    const { formatId } = req.params;
    const fmt = FORMAT_TAXONOMY.find(f => f.id === formatId);
    if (!fmt) return res.status(404).json({ error: 'Unknown format' });
    const rows = await seQuery(
      `SELECT video_id, title, views, gcs_path, auto_captions
       FROM videos
       WHERE channel = 'camman18' AND format_id = $1
       ORDER BY views DESC LIMIT 5`,
      [formatId]
    );
    const top_videos = await enrichVideosWithUrls(rows);
    res.json({ ...fmt, top_videos });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch format reference' });
  }
});

// PATCH /api/script-engine/critiques/:id/mark — mark human_status (used/not_used/null)
scriptEngineRouter.patch('/critiques/:id/mark', async (req: Request, res: Response) => {
  try {
    const { human_status } = req.body;
    if (human_status !== 'used' && human_status !== 'not_used' && human_status !== null) {
      return res.status(400).json({ error: 'human_status must be "used", "not_used", or null' });
    }
    await seQuery('UPDATE script_critiques SET human_status = $1 WHERE id = $2', [human_status, req.params.id]);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to mark critique' });
  }
});

// GET /api/script-engine/token-usage — cost + token rollups for the Pipeline tab.
// Returns per-day totals for the last 14 days + per-task totals for the last 7d.
// Will be all-zeroes until a flow starts using the ai/ SDK path — treat empty
// arrays as "SDK not wired yet" on the frontend.
scriptEngineRouter.get('/token-usage', async (_req: Request, res: Response) => {
  try {
    const byDay = await seQuery(`
      SELECT
        DATE_TRUNC('day', created_at)::DATE AS day,
        SUM(input_tokens + output_tokens + cache_read_input_tokens + cache_creation_input_tokens)::BIGINT AS tokens,
        SUM(cost_usd)::FLOAT AS cost_usd
      FROM token_usage
      WHERE created_at > NOW() - INTERVAL '14 days'
      GROUP BY day ORDER BY day ASC
    `);
    const byTask = await seQuery(`
      SELECT task,
        COUNT(*)::INT AS calls,
        SUM(input_tokens + output_tokens)::BIGINT AS tokens,
        SUM(cache_read_input_tokens)::BIGINT AS cache_read_tokens,
        SUM(cost_usd)::FLOAT AS cost_usd
      FROM token_usage
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY task ORDER BY cost_usd DESC
    `);
    const totals = await seQuery(`
      SELECT
        COALESCE(SUM(cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'), 0)::FLOAT AS cost_7d,
        COALESCE(SUM(cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '1 day'), 0)::FLOAT AS cost_24h,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::INT AS calls_7d
      FROM token_usage
    `);
    res.json({
      by_day: byDay,
      by_task: byTask,
      totals: totals[0] || { cost_7d: 0, cost_24h: 0, calls_7d: 0 },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch token usage' });
  }
});

// GET /api/script-engine/runs — run history
scriptEngineRouter.get('/runs', async (_req: Request, res: Response) => {
  try {
    const runs = await seQuery(`
      SELECT r.id, r.status, r.total_ideas, r.duplicates_removed, r.errors_count,
        r.started_at, r.completed_at,
        EXTRACT(EPOCH FROM (r.completed_at - r.started_at))::INTEGER as duration_sec,
        json_agg(json_build_object(
          'agent', rs.agent, 'status', rs.status,
          'items_processed', rs.items_processed, 'ideas_generated', rs.ideas_generated,
          'duration_sec', EXTRACT(EPOCH FROM (rs.completed_at - rs.started_at))::INTEGER,
          'errors', rs.errors
        ) ORDER BY rs.agent) as steps
      FROM runs r
      LEFT JOIN run_steps rs ON r.id = rs.run_id
      GROUP BY r.id
      ORDER BY r.id DESC
      LIMIT 20
    `);
    res.json(runs);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch runs' });
  }
});
