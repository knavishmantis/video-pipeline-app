import { Response } from 'express';
import { query } from '../db';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const teamMetricsController = {
  async get(req: AuthRequest, res: Response): Promise<void> {
    try {
      const isAdmin = req.userRoles?.includes('admin') || req.userRole === 'admin';
      if (!isAdmin) {
        res.status(403).json({ error: 'Only admins can view team metrics' });
        return;
      }

      // Per-user production stats, scoped to clippers + editors.
      // The channel's shared account (knavishmantis@gmail.com) is excluded so it
      // doesn't pollute the team view.
      const userStatsResult = await query(`
        WITH user_assignment_counts AS (
          SELECT
            a.user_id,
            a.role,
            COUNT(*)::int as total_assignments,
            COUNT(a.completed_at)::int as completed_assignments,
            COUNT(CASE WHEN a.completed_at IS NULL THEN 1 END)::int as current_load,
            COUNT(
              CASE
                WHEN a.completed_at IS NOT NULL
                 AND (
                   (a.role = 'clipper' AND s.entered_clip_changes_at IS NOT NULL) OR
                   (a.role = 'editor'  AND s.entered_editing_changes_at IS NOT NULL)
                 )
                THEN 1
              END
            )::int as rework_count,
            AVG(
              CASE WHEN a.completed_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM (a.completed_at - a.created_at)) / 3600.0
              ELSE NULL END
            ) as avg_turnaround_hours
          FROM assignments a
          LEFT JOIN shorts s ON s.id = a.short_id
          WHERE a.role IN ('clipper', 'editor')
          GROUP BY a.user_id, a.role
        ),
        user_last_activity AS (
          SELECT
            f.uploaded_by as user_id,
            CASE WHEN f.file_type = 'clips_zip' THEN 'clipper'
                 WHEN f.file_type = 'final_video' THEN 'editor'
            END as role,
            MAX(f.uploaded_at) as last_submission_at
          FROM files f
          WHERE f.file_type IN ('clips_zip', 'final_video')
          GROUP BY f.uploaded_by, f.file_type
        )
        SELECT
          u.id as user_id,
          u.name,
          u.discord_username,
          u.profile_picture,
          ur.role,
          COALESCE(uac.total_assignments, 0) as total_assignments,
          COALESCE(uac.completed_assignments, 0) as completed_assignments,
          COALESCE(uac.current_load, 0) as current_load,
          COALESCE(uac.rework_count, 0) as rework_count,
          ROUND(uac.avg_turnaround_hours::numeric, 1) as avg_turnaround_hours,
          ula.last_submission_at
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id AND ur.role IN ('clipper', 'editor')
        LEFT JOIN user_assignment_counts uac ON uac.user_id = u.id AND uac.role = ur.role
        LEFT JOIN user_last_activity ula ON ula.user_id = u.id AND ula.role = ur.role
        WHERE u.email != 'knavishmantis@gmail.com'
        ORDER BY ur.role, completed_assignments DESC
      `);

      res.json({ users: userStatsResult.rows });
    } catch (error) {
      logger.error('Get team metrics error', { error });
      res.status(500).json({ error: 'Failed to fetch team metrics' });
    }
  },
};
