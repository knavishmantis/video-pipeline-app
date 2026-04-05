import { Router, Response } from 'express';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { query } from '../db';
import { getSignedUrl, getSignedUploadUrl } from '../services/gcpStorage';
import { logger } from '../utils/logger';

export const sampleAssignmentsRouter = Router();

sampleAssignmentsRouter.use(authenticateToken);

// ─── Helper: load a sample + its scenes ────────────────────────────────────────
async function loadSampleWithScenes(sampleId: number) {
  const sampleResult = await query(
    `SELECT s.*, sh.title AS source_short_title, sh.description AS source_short_description,
            u.name AS prospect_display_name, u.discord_username AS prospect_discord,
            cu.name AS created_by_name
     FROM sample_assignments s
     JOIN shorts sh ON sh.id = s.source_short_id
     JOIN users u ON u.id = s.user_id
     LEFT JOIN users cu ON cu.id = s.created_by
     WHERE s.id = $1`,
    [sampleId]
  );
  if (sampleResult.rows.length === 0) return null;
  const sample = sampleResult.rows[0];

  const scenesResult = await query(
    `SELECT sc.id, sc.short_id, sc.scene_order, sc.script_line, sc.direction,
            sc.clipper_notes, sc.image_url, sc.link_group, sc.preset_clip_id,
            sas.display_order
     FROM sample_assignment_scenes sas
     JOIN scenes sc ON sc.id = sas.scene_id
     WHERE sas.sample_assignment_id = $1
     ORDER BY sas.display_order ASC`,
    [sampleId]
  );

  // Load scene images for each scene
  const scenes = await Promise.all(
    scenesResult.rows.map(async (scene: any) => {
      const imagesResult = await query(
        'SELECT id, scene_id, bucket_path, file_type FROM scene_images WHERE scene_id = $1 ORDER BY id ASC',
        [scene.id]
      );
      // Generate signed URLs for images
      const images = await Promise.all(
        imagesResult.rows.map(async (img: any) => {
          try {
            const url = await getSignedUrl(img.bucket_path, 3600);
            return { ...img, url };
          } catch {
            return { ...img, url: null };
          }
        })
      );
      return { ...scene, images };
    })
  );

  return {
    id: sample.id,
    source_short_id: sample.source_short_id,
    source_short_title: sample.source_short_title,
    user_id: sample.user_id,
    prospect_email: sample.prospect_email,
    prospect_name: sample.prospect_name,
    prospect_discord: sample.prospect_discord,
    created_by: sample.created_by,
    created_by_name: sample.created_by_name,
    created_at: sample.created_at,
    expires_at: sample.expires_at,
    submitted_at: sample.submitted_at,
    submission_bucket_path: sample.submission_bucket_path,
    submission_file_name: sample.submission_file_name,
    submission_file_size: sample.submission_file_size,
    review_status: sample.review_status,
    reviewed_at: sample.reviewed_at,
    promoted_at: sample.promoted_at,
    scenes,
  };
}

// ─── Sample clipper: fetch their own active sample ─────────────────────────────
// GET /api/samples/me
sampleAssignmentsRouter.get('/me', async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const isSampleClipper = req.userRoles?.includes('sample_clipper') || req.userRole === 'sample_clipper';
  if (!isSampleClipper) {
    res.status(403).json({ error: 'Sample clipper access only' });
    return;
  }
  try {
    const row = await query(
      `SELECT id FROM sample_assignments
       WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC LIMIT 1`,
      [req.userId]
    );
    if (row.rows.length === 0) {
      res.status(404).json({ error: 'No active sample assignment found' });
      return;
    }
    const sample = await loadSampleWithScenes(row.rows[0].id);
    res.json(sample);
  } catch (error) {
    logger.error('Failed to load sample for sample_clipper', { userId: req.userId, error });
    res.status(500).json({ error: 'Failed to load sample' });
  }
});

// POST /api/samples/me/upload-url  — get signed URL to upload the submission zip
sampleAssignmentsRouter.post('/me/upload-url', async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const isSampleClipper = req.userRoles?.includes('sample_clipper') || req.userRole === 'sample_clipper';
  if (!isSampleClipper) {
    res.status(403).json({ error: 'Sample clipper access only' });
    return;
  }
  const { file_name, file_size, content_type } = req.body;
  if (!file_name || !file_size || !content_type) {
    res.status(400).json({ error: 'file_name, file_size, and content_type are required' });
    return;
  }
  try {
    const row = await query(
      `SELECT id, submitted_at FROM sample_assignments
       WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC LIMIT 1`,
      [req.userId]
    );
    if (row.rows.length === 0) {
      res.status(404).json({ error: 'No active sample assignment found' });
      return;
    }
    if (row.rows[0].submitted_at) {
      res.status(400).json({ error: 'Sample has already been submitted' });
      return;
    }
    const sampleId = row.rows[0].id;
    const bucketPath = `samples/${sampleId}/${Date.now()}-${file_name}`;
    const uploadUrl = await getSignedUploadUrl(bucketPath, content_type, 3600);
    res.json({ upload_url: uploadUrl, bucket_path: bucketPath, expires_in: 3600 });
  } catch (error) {
    logger.error('Failed to create upload URL for sample', { userId: req.userId, error });
    res.status(500).json({ error: 'Failed to create upload URL' });
  }
});

// POST /api/samples/me/discord  — sample clipper sets/updates their Discord username
sampleAssignmentsRouter.post('/me/discord', async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const isSampleClipper = req.userRoles?.includes('sample_clipper') || req.userRole === 'sample_clipper';
  if (!isSampleClipper) {
    res.status(403).json({ error: 'Sample clipper access only' });
    return;
  }
  const { discord_username } = req.body;
  if (!discord_username || typeof discord_username !== 'string' || !discord_username.trim()) {
    res.status(400).json({ error: 'discord_username is required' });
    return;
  }
  try {
    await query(
      'UPDATE users SET discord_username = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [discord_username.trim(), req.userId]
    );
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to save discord username', { userId: req.userId, error });
    res.status(500).json({ error: 'Failed to save discord username' });
  }
});

// POST /api/samples/me/submit  — confirm submission after GCS upload
sampleAssignmentsRouter.post('/me/submit', async (req: AuthRequest, res: Response) => {
  if (!req.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const isSampleClipper = req.userRoles?.includes('sample_clipper') || req.userRole === 'sample_clipper';
  if (!isSampleClipper) {
    res.status(403).json({ error: 'Sample clipper access only' });
    return;
  }
  const { bucket_path, file_name, file_size } = req.body;
  if (!bucket_path || !file_name || !file_size) {
    res.status(400).json({ error: 'bucket_path, file_name, and file_size are required' });
    return;
  }
  try {
    const row = await query(
      `SELECT id, submitted_at FROM sample_assignments
       WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC LIMIT 1`,
      [req.userId]
    );
    if (row.rows.length === 0) {
      res.status(404).json({ error: 'No active sample assignment found' });
      return;
    }
    if (row.rows[0].submitted_at) {
      res.status(400).json({ error: 'Sample has already been submitted' });
      return;
    }
    await query(
      `UPDATE sample_assignments
       SET submitted_at = CURRENT_TIMESTAMP,
           submission_bucket_path = $1,
           submission_file_name = $2,
           submission_file_size = $3,
           review_status = 'pending'
       WHERE id = $4`,
      [bucket_path, file_name, parseInt(file_size), row.rows[0].id]
    );
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to confirm sample submission', { userId: req.userId, error });
    res.status(500).json({ error: 'Failed to confirm submission' });
  }
});

// ─── Admin endpoints ──────────────────────────────────────────────────────────
// POST /api/samples  — create a new sample assignment
sampleAssignmentsRouter.post('/', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { source_short_id, prospect_email, prospect_name, scene_ids, expires_in_days } = req.body;
  if (!source_short_id || !prospect_email || !prospect_name || !Array.isArray(scene_ids) || scene_ids.length === 0) {
    res.status(400).json({ error: 'source_short_id, prospect_email, prospect_name, and scene_ids (non-empty array) are required' });
    return;
  }
  if (scene_ids.length > 20) {
    res.status(400).json({ error: 'Maximum 20 scenes per sample' });
    return;
  }

  try {
    // Verify source short exists
    const shortCheck = await query('SELECT id FROM shorts WHERE id = $1', [source_short_id]);
    if (shortCheck.rows.length === 0) {
      res.status(404).json({ error: 'Source short not found' });
      return;
    }

    // Verify all scene_ids belong to the source short (dynamic IN clause for SQLite compat)
    const numericSceneIds: number[] = scene_ids.map((id: any) => parseInt(id)).filter((n: number) => !isNaN(n));
    if (numericSceneIds.length !== scene_ids.length) {
      res.status(400).json({ error: 'scene_ids must be integers' });
      return;
    }
    const placeholders = numericSceneIds.map((_, i) => `$${i + 2}`).join(', ');
    const sceneCheck = await query(
      `SELECT id FROM scenes WHERE short_id = $1 AND id IN (${placeholders})`,
      [source_short_id, ...numericSceneIds]
    );
    if (sceneCheck.rows.length !== numericSceneIds.length) {
      res.status(400).json({ error: 'Some scene_ids do not belong to the source short' });
      return;
    }

    const normalizedEmail = String(prospect_email).trim().toLowerCase();
    const expiresDays = Math.max(1, Math.min(60, parseInt(expires_in_days) || 14));

    // Find or create the sample_clipper user for this email
    let userResult = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    let userId: number;
    if (userResult.rows.length === 0) {
      userResult = await query(
        `INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id`,
        [normalizedEmail, prospect_name]
      );
      userId = userResult.rows[0].id;
      await query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [userId, 'sample_clipper']);
    } else {
      userId = userResult.rows[0].id;
      // Ensure they have the sample_clipper role
      await query(
        `INSERT INTO user_roles (user_id, role) VALUES ($1, 'sample_clipper')
         ON CONFLICT DO NOTHING`,
        [userId]
      );
    }

    // Create the sample assignment
    const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);
    const sampleResult = await query(
      `INSERT INTO sample_assignments
       (source_short_id, user_id, prospect_email, prospect_name, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [source_short_id, userId, normalizedEmail, prospect_name, req.userId, expiresAt.toISOString()]
    );
    const sampleId = sampleResult.rows[0].id;

    // Link scenes via junction table
    for (let i = 0; i < numericSceneIds.length; i++) {
      await query(
        'INSERT INTO sample_assignment_scenes (sample_assignment_id, scene_id, display_order) VALUES ($1, $2, $3)',
        [sampleId, numericSceneIds[i], i]
      );
    }

    const created = await loadSampleWithScenes(sampleId);
    res.status(201).json(created);
  } catch (error) {
    logger.error('Failed to create sample assignment', { error });
    res.status(500).json({ error: 'Failed to create sample assignment' });
  }
});

// GET /api/samples  — list all sample assignments (admin)
sampleAssignmentsRouter.get('/', requireRole('admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT s.id, s.source_short_id, s.prospect_email, s.prospect_name,
              s.created_at, s.expires_at, s.submitted_at, s.review_status, s.promoted_at,
              sh.title AS source_short_title,
              u.discord_username AS prospect_discord,
              (SELECT COUNT(*) FROM sample_assignment_scenes sas WHERE sas.sample_assignment_id = s.id) AS scene_count
       FROM sample_assignments s
       JOIN shorts sh ON sh.id = s.source_short_id
       JOIN users u ON u.id = s.user_id
       ORDER BY s.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    logger.error('Failed to list sample assignments', { error });
    res.status(500).json({ error: 'Failed to list samples' });
  }
});

// GET /api/samples/:id  — get one sample with full detail (admin)
sampleAssignmentsRouter.get('/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const sampleId = parseInt(req.params.id);
    if (isNaN(sampleId)) {
      res.status(400).json({ error: 'Invalid sample id' });
      return;
    }
    const sample = await loadSampleWithScenes(sampleId);
    if (!sample) {
      res.status(404).json({ error: 'Sample not found' });
      return;
    }
    // If submitted, include a signed download URL for the zip
    let submission_download_url: string | null = null;
    if (sample.submission_bucket_path) {
      try {
        submission_download_url = await getSignedUrl(sample.submission_bucket_path, 3600);
      } catch (err) {
        logger.warn('Could not generate signed URL for sample submission', { sampleId, err });
      }
    }
    res.json({ ...sample, submission_download_url });
  } catch (error) {
    logger.error('Failed to load sample', { error });
    res.status(500).json({ error: 'Failed to load sample' });
  }
});

// DELETE /api/samples/:id  — delete a sample (admin)
sampleAssignmentsRouter.delete('/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const sampleId = parseInt(req.params.id);
    if (isNaN(sampleId)) {
      res.status(400).json({ error: 'Invalid sample id' });
      return;
    }
    await query('DELETE FROM sample_assignments WHERE id = $1', [sampleId]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete sample', { error });
    res.status(500).json({ error: 'Failed to delete sample' });
  }
});

// POST /api/samples/:id/review  — set review status (admin)
sampleAssignmentsRouter.post('/:id/review', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const sampleId = parseInt(req.params.id);
    const { review_status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(review_status)) {
      res.status(400).json({ error: 'review_status must be approved, rejected, or pending' });
      return;
    }
    await query(
      `UPDATE sample_assignments SET review_status = $1, reviewed_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [review_status, sampleId]
    );
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to update review status', { error });
    res.status(500).json({ error: 'Failed to update review status' });
  }
});

// POST /api/samples/:id/promote  — promote a sample_clipper to a real clipper (admin)
sampleAssignmentsRouter.post('/:id/promote', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const sampleId = parseInt(req.params.id);
    if (isNaN(sampleId)) {
      res.status(400).json({ error: 'Invalid sample id' });
      return;
    }
    const sampleRow = await query(
      'SELECT id, user_id, submitted_at, promoted_at FROM sample_assignments WHERE id = $1',
      [sampleId]
    );
    if (sampleRow.rows.length === 0) {
      res.status(404).json({ error: 'Sample not found' });
      return;
    }
    const sample = sampleRow.rows[0];
    if (!sample.submitted_at) {
      res.status(400).json({ error: 'Cannot promote a prospect who has not submitted their sample' });
      return;
    }
    if (sample.promoted_at) {
      res.status(400).json({ error: 'This prospect has already been promoted' });
      return;
    }

    // Swap roles: remove sample_clipper, add clipper
    await query(
      `DELETE FROM user_roles WHERE user_id = $1 AND role = 'sample_clipper'`,
      [sample.user_id]
    );
    await query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, 'clipper')
       ON CONFLICT DO NOTHING`,
      [sample.user_id]
    );

    // Mark the sample as promoted + auto-approve if not already reviewed
    await query(
      `UPDATE sample_assignments
       SET promoted_at = CURRENT_TIMESTAMP,
           review_status = COALESCE(review_status, 'approved'),
           reviewed_at = COALESCE(reviewed_at, CURRENT_TIMESTAMP)
       WHERE id = $1`,
      [sampleId]
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to promote sample', { error });
    res.status(500).json({ error: 'Failed to promote prospect' });
  }
});
