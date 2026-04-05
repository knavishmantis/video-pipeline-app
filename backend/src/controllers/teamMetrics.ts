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

      // Per-user submission stats
      // A "submission" = uploading clips_zip (clipper) or final_video (editor)
      // Note: the channel's shared account (knavishmantis@gmail.com) is excluded
      // so it doesn't pollute team metrics.
      const userStatsResult = await query(`
        WITH user_submissions AS (
          SELECT
            u.id as user_id,
            u.name,
            u.discord_username,
            u.profile_picture,
            ur.role,
            f.id as file_id,
            f.uploaded_at,
            f.short_id
          FROM users u
          JOIN user_roles ur ON u.id = ur.user_id AND ur.role IN ('clipper', 'editor')
          LEFT JOIN files f ON f.uploaded_by = u.id AND (
            (ur.role = 'clipper' AND f.file_type = 'clips_zip') OR
            (ur.role = 'editor' AND f.file_type = 'final_video')
          )
          WHERE u.email != 'knavishmantis@gmail.com'
        ),
        user_assignment_counts AS (
          SELECT
            a.user_id,
            a.role,
            COUNT(*) as total_assignments,
            COUNT(a.completed_at) as completed_assignments,
            AVG(
              CASE WHEN a.completed_at IS NOT NULL
              THEN EXTRACT(EPOCH FROM (a.completed_at - a.created_at)) / 3600.0
              ELSE NULL END
            ) as avg_turnaround_hours
          FROM assignments a
          WHERE a.role IN ('clipper', 'editor')
          GROUP BY a.user_id, a.role
        )
        SELECT
          us.user_id,
          us.name,
          us.discord_username,
          us.profile_picture,
          us.role,
          COALESCE(uac.total_assignments, 0)::int as total_assignments,
          COALESCE(uac.completed_assignments, 0)::int as completed_assignments,
          COUNT(DISTINCT us.file_id)::int as total_submissions,
          MIN(us.uploaded_at) as first_submission_at,
          MAX(us.uploaded_at) as last_submission_at,
          COUNT(DISTINCT CASE WHEN us.uploaded_at >= NOW() - INTERVAL '7 days' THEN us.file_id END)::int as submissions_last7,
          COUNT(DISTINCT CASE WHEN us.uploaded_at >= NOW() - INTERVAL '30 days' THEN us.file_id END)::int as submissions_last30,
          ROUND(uac.avg_turnaround_hours::numeric, 1) as avg_turnaround_hours
        FROM user_submissions us
        LEFT JOIN user_assignment_counts uac ON us.user_id = uac.user_id AND us.role = uac.role
        GROUP BY us.user_id, us.name, us.discord_username, us.profile_picture, us.role,
                 uac.total_assignments, uac.completed_assignments, uac.avg_turnaround_hours
        ORDER BY us.role, total_submissions DESC
      `);

      // Daily submission timeline (last 90 days)
      const dailyResult = await query(`
        SELECT
          d.date::text as date,
          COALESCE(SUM(CASE WHEN ur.role = 'clipper' AND f.file_type = 'clips_zip' THEN 1 ELSE 0 END), 0)::int as clipper_submissions,
          COALESCE(SUM(CASE WHEN ur.role = 'editor' AND f.file_type = 'final_video' THEN 1 ELSE 0 END), 0)::int as editor_submissions
        FROM generate_series(
          (NOW() - INTERVAL '90 days')::date,
          NOW()::date,
          '1 day'::interval
        ) d(date)
        LEFT JOIN files f ON DATE(f.uploaded_at) = d.date AND f.file_type IN ('clips_zip', 'final_video')
        LEFT JOIN users u ON f.uploaded_by = u.id AND u.email != 'knavishmantis@gmail.com'
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.role IN ('clipper', 'editor')
        GROUP BY d.date
        ORDER BY d.date
      `);

      // Per-user daily breakdown (for individual sparklines)
      const perUserDailyResult = await query(`
        SELECT
          f.uploaded_by as user_id,
          ur.role,
          DATE(f.uploaded_at)::text as date,
          COUNT(*)::int as submissions
        FROM files f
        JOIN users u ON f.uploaded_by = u.id
        JOIN user_roles ur ON u.id = ur.user_id AND ur.role IN ('clipper', 'editor')
        WHERE f.file_type IN ('clips_zip', 'final_video')
          AND u.email != 'knavishmantis@gmail.com'
          AND (
            (ur.role = 'clipper' AND f.file_type = 'clips_zip') OR
            (ur.role = 'editor' AND f.file_type = 'final_video')
          )
          AND f.uploaded_at >= NOW() - INTERVAL '90 days'
        GROUP BY f.uploaded_by, ur.role, DATE(f.uploaded_at)
        ORDER BY date
      `);

      // Calculate avg_per_day for each user
      const users = userStatsResult.rows.map((u: any) => {
        const totalSubs = u.total_submissions;
        const first = u.first_submission_at ? new Date(u.first_submission_at) : null;
        const last = u.last_submission_at ? new Date(u.last_submission_at) : null;
        let avgPerDay = 0;
        if (first && last && totalSubs > 0) {
          const daySpan = Math.max(1, Math.ceil((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)) + 1);
          avgPerDay = Math.round((totalSubs / daySpan) * 100) / 100;
        }
        const avgPerDayLast30 = u.submissions_last30 > 0 ? Math.round((u.submissions_last30 / 30) * 100) / 100 : 0;

        return {
          ...u,
          avg_per_day: avgPerDay,
          avg_per_day_last30: avgPerDayLast30,
        };
      });

      res.json({
        users,
        daily_submissions: dailyResult.rows,
        per_user_daily: perUserDailyResult.rows,
      });
    } catch (error) {
      logger.error('Get team metrics error', { error });
      res.status(500).json({ error: 'Failed to fetch team metrics' });
    }
  },
};
