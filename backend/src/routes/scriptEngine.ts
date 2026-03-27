import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticateToken, requireRole } from '../middleware/auth';

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
    // Runs
    const runs = await seQuery(`
      SELECT id, status, total_ideas, duplicates_removed, errors_count,
        started_at, completed_at,
        EXTRACT(EPOCH FROM (completed_at - started_at))::INTEGER as duration_sec
      FROM runs ORDER BY id DESC LIMIT 10
    `);

    // Steps for latest run
    const latestRunId = runs[0]?.id;
    const steps = latestRunId ? await seQuery(`
      SELECT agent, status, items_processed, ideas_generated, errors,
        started_at, completed_at,
        EXTRACT(EPOCH FROM (completed_at - started_at))::INTEGER as duration_sec
      FROM run_steps WHERE run_id = $1 ORDER BY agent
    `, [latestRunId]) : [];

    // Ideas by status
    const ideaStats = await seQuery(`
      SELECT status, COUNT(*)::INTEGER as count FROM ideas GROUP BY status ORDER BY count DESC
    `);

    // Ideas by source
    const ideaSources = await seQuery(`
      SELECT source, COUNT(*)::INTEGER as count FROM ideas GROUP BY source ORDER BY count DESC
    `);

    // Recent ideas
    const recentIdeas = await seQuery(`
      SELECT id, source, title, status, confidence, created_at
      FROM ideas ORDER BY id DESC LIMIT 15
    `);

    // Research briefs
    const briefStats = await seQuery(`
      SELECT COUNT(*)::INTEGER as total,
        COUNT(*) FILTER (WHERE verdict = 'validated' OR verdict = 'greenlight' OR verdict = 'confirmed' OR verdict = 'approved')::INTEGER as validated,
        COUNT(*) FILTER (WHERE verdict = 'rejected')::INTEGER as rejected
      FROM research_briefs
    `);

    const recentBriefs = await seQuery(`
      SELECT rb.id, rb.idea_id, rb.verdict, rb.verdict_reason, rb.created_at,
        i.title, i.source
      FROM research_briefs rb JOIN ideas i ON rb.idea_id = i.id
      ORDER BY rb.created_at DESC LIMIT 10
    `);

    // Data collection stats (only relevant channels we download)
    const videoStats = await seQuery(`
      SELECT
        COUNT(*)::INTEGER as total,
        COUNT(*) FILTER (WHERE is_short)::INTEGER as shorts,
        COUNT(*) FILTER (WHERE auto_captions IS NOT NULL AND is_short)::INTEGER as captions,
        COUNT(*) FILTER (WHERE gcs_path IS NOT NULL AND is_short)::INTEGER as in_gcs
      FROM videos
      WHERE channel IN ('camman18', 'DashPum4', 'Skip the Tutorial', 'TurbaneMC')
    `);

    const dataCounts = {
      bugs: (await seQuery('SELECT COUNT(*)::INTEGER as c FROM bugs'))[0]?.c || 0,
      reddit: (await seQuery('SELECT COUNT(*)::INTEGER as c FROM reddit_posts'))[0]?.c || 0,
      mods: (await seQuery('SELECT COUNT(*)::INTEGER as c FROM mods'))[0]?.c || 0,
      versions: (await seQuery('SELECT COUNT(*)::INTEGER as c FROM mc_versions'))[0]?.c || 0,
      wiki: (await seQuery('SELECT COUNT(*)::INTEGER as c FROM wiki_pages'))[0]?.c || 0,
    };

    res.json({
      runs,
      latestSteps: steps,
      ideaStats,
      ideaSources,
      recentIdeas,
      briefStats: briefStats[0],
      recentBriefs,
      videoStats: videoStats[0],
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

// GET /api/script-engine/briefs — all research briefs
scriptEngineRouter.get('/briefs', async (_req: Request, res: Response) => {
  try {
    const briefs = await seQuery(`
      SELECT rb.id, rb.idea_id, rb.verdict, rb.verdict_reason, rb.created_at,
        i.title, i.source
      FROM research_briefs rb JOIN ideas i ON rb.idea_id = i.id
      ORDER BY rb.created_at DESC
    `);
    res.json(briefs);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch briefs' });
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
