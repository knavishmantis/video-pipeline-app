import { Router, Request, Response } from 'express';
import { scenesController } from '../controllers/scenes';
import { authenticateToken } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';
import { validate } from '../middleware/validate';
import { createSceneSchema, updateSceneSchema, bulkCreateScenesSchema, reorderScenesSchema } from '../validators/scenes';
import { suggestLinkGroups } from '../services/vertexAI';
import { query } from '../db';
import { logger } from '../utils/logger';

export const scenesRouter = Router({ mergeParams: true });

scenesRouter.use(authenticateToken);
scenesRouter.use(requireProfileComplete);

// GET /api/shorts/:shortId/scenes
scenesRouter.get('/', scenesController.getAll);

// GET /api/shorts/:shortId/scenes/:id/image-url (legacy, must be before /:id)
scenesRouter.get('/:id/image-url', scenesController.getImageUrl);

// POST /api/shorts/:shortId/scenes/:id/images
scenesRouter.post('/:id/images', scenesController.addImage);

// GET /api/shorts/:shortId/scenes/:id/images/:imageId/url
scenesRouter.get('/:id/images/:imageId/url', scenesController.getSceneImageUrl);

// DELETE /api/shorts/:shortId/scenes/:id/images/:imageId
scenesRouter.delete('/:id/images/:imageId', scenesController.deleteImage);

// GET /api/shorts/:shortId/scenes/:id
scenesRouter.get('/:id', scenesController.getById);

// POST /api/shorts/:shortId/scenes/bulk - Replace all scenes at once (must be before /:id)
scenesRouter.post('/bulk', validate(bulkCreateScenesSchema), scenesController.bulkCreate);

// POST /api/shorts/:shortId/scenes/generate-segments
// Uses Gemini to split the short's script_content into scene segments (does NOT write to DB)
scenesRouter.post('/generate-segments', async (req: Request, res: Response) => {
  const { shortId } = req.params;
  try {
    const shortResult = await query('SELECT script_content FROM shorts WHERE id = $1', [shortId]);
    if (shortResult.rows.length === 0) { res.status(404).json({ error: 'Short not found' }); return; }
    const script: string = shortResult.rows[0].script_content ?? '';
    if (!script.trim()) { res.status(400).json({ error: 'Short has no script content' }); return; }

    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    if (!accessToken.token) throw new Error('Failed to get access token');

    const PROJECT_ID = process.env.GCP_PROJECT_ID;
    const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const endpoint = `https://us-central1-aiplatform.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/us-central1/publishers/google/models/${MODEL}:generateContent`;

    const prompt = `Split this Minecraft YouTube Short script into scenes for video production. Each scene = one continuous shot or setup.

Rules:
- Split only at sentence boundaries — never mid-sentence
- Each scene: 1-3 sentences, short enough to film in one take
- Aim for 6-14 scenes total
- Include ALL words from the script — do not add, omit, or rephrase anything
- Return ONLY a JSON array of strings

Script:
${script}

Return ONLY valid JSON like: ["Scene 1 text.", "Scene 2 text."]`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048, responseMimeType: 'application/json' },
      }),
    });
    if (!response.ok) { const e = await response.text(); res.status(500).json({ error: `Gemini error: ${e.substring(0, 200)}` }); return; }
    const data = await response.json() as any;
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const segments: string[] = JSON.parse(text.trim());
    res.json({ segments });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/shorts/:shortId/scenes/auto-link-groups
// Uses Gemini to suggest link groups and applies them
scenesRouter.post('/auto-link-groups', async (req: Request, res: Response) => {
  const { shortId } = req.params;
  try {
    const scenesResult = await query(
      'SELECT id, scene_order, script_line, direction, clipper_notes FROM scenes WHERE short_id = $1 ORDER BY scene_order ASC',
      [shortId]
    );
    if (scenesResult.rows.length === 0) {
      res.json({ applied: [] });
      return;
    }

    const suggestions = await suggestLinkGroups(scenesResult.rows);

    // Apply all suggestions in parallel
    await Promise.all(suggestions.map(s =>
      query('UPDATE scenes SET link_group = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND short_id = $3', [s.link_group, s.scene_id, shortId])
    ));

    res.json({ applied: suggestions });
  } catch (e: any) {
    logger.error('Auto link group generation failed', { shortId, error: e.message, stack: e.stack?.substring(0, 500) });
    res.status(500).json({ error: e.message });
  }
});

// POST /api/shorts/:shortId/scenes/:id/similar-cuts
// Retrieval + rerank against the competitor cut library for a specific scene.
// Derives script_line + surrounding context from the scene+short. Writers/admins.
scenesRouter.post('/:id/similar-cuts', async (req: Request, res: Response) => {
  const { shortId, id } = req.params;
  try {
    const { k = 5, channel } = req.body || {};
    const finalK = Math.min(10, Math.max(1, Math.floor(k)));

    // Pull target scene + all siblings for context
    const sceneRows = await query(
      `SELECT id, scene_order, script_line, direction, clipper_notes
       FROM scenes WHERE short_id = $1 ORDER BY scene_order ASC`,
      [shortId]
    );
    const target = sceneRows.rows.find((s: any) => String(s.id) === String(id));
    if (!target) { res.status(404).json({ error: 'Scene not found' }); return; }

    const before = sceneRows.rows.filter((s: any) => s.scene_order < target.scene_order).slice(-2);
    const after = sceneRows.rows.filter((s: any) => s.scene_order > target.scene_order).slice(0, 2);
    const shortContext = [
      ...before.map((s: any) => `Before (#${s.scene_order}): ${s.script_line || ''}`),
      ...after.map((s: any) => `After (#${s.scene_order}): ${s.script_line || ''}`),
    ].filter(Boolean).join(' | ');

    // Proxy to the shared services; this route does NOT require admin role
    const { searchSimilarCuts, rerankCandidates } = await import('../services/competitorCutAnalysis');
    const { getSignedUrlFromBucket } = await import('../services/gcpStorage');
    const { Pool } = await import('pg');

    const mainDbUrl = process.env.DATABASE_URL || '';
    const host = mainDbUrl.match(/@([^:]+):/)?.[1] || '34.58.157.140';
    const sePool = new Pool({
      host, port: 5432,
      database: 'script_engine', user: 'script_engine',
      password: process.env.SCRIPT_ENGINE_DB_PASSWORD || 'MC@w@W_J:1?K{pUi(ht8mh)sUh4MzVfX',
      max: 2,
    });

    try {
      const queryText = [target.script_line, target.direction, shortContext].filter(Boolean).join('. ');
      const candidates = await searchSimilarCuts(sePool, { queryText, k: finalK * 4, channel });
      const ranked = await rerankCandidates({
        scriptLine: target.script_line || '',
        shortContext,
        candidates,
        finalK,
      });

      const bucket = process.env.SCRIPT_ENGINE_GCS_BUCKET || 'knavishmantis-script-engine';
      const withUrls = await Promise.all(ranked.map(async (r) => {
        const rows = await sePool.query('SELECT gcs_path FROM videos WHERE id = $1', [r.competitor_video_id]);
        const gcs = rows.rows[0]?.gcs_path;
        let signed_video_url: string | null = null;
        if (gcs) {
          const path = gcs.startsWith('gs://') ? gcs.replace(/^gs:\/\/[^/]+\//, '') : gcs;
          const bucketName = gcs.startsWith('gs://') ? gcs.slice(5).split('/')[0] : bucket;
          const base = await getSignedUrlFromBucket(bucketName, path, 3600, 'video/mp4');
          signed_video_url = `${base}#t=${(r.start_ms / 1000).toFixed(2)},${(r.end_ms / 1000).toFixed(2)}`;
        }
        return { ...r, signed_video_url };
      }));
      res.json({ scene_id: target.id, suggestions: withUrls });
    } finally {
      await sePool.end();
    }
  } catch (e: any) {
    logger.error('similar-cuts failed', { shortId, sceneId: id, error: e?.message });
    res.status(500).json({ error: e?.message || 'search failed' });
  }
});

// POST /api/shorts/:shortId/scenes/reorder (must be before /:id)
scenesRouter.post('/reorder', validate(reorderScenesSchema), scenesController.reorder);

// POST /api/shorts/:shortId/scenes
scenesRouter.post('/', validate(createSceneSchema), scenesController.create);

// PUT /api/shorts/:shortId/scenes/:id
scenesRouter.put('/:id', validate(updateSceneSchema), scenesController.update);

// DELETE /api/shorts/:shortId/scenes/:id
scenesRouter.delete('/:id', scenesController.delete);
