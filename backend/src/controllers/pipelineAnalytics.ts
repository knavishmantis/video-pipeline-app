import { Response } from 'express';
import { query } from '../db';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const STATUS_ORDER = ['idea', 'script', 'clipping', 'clips', 'clip_changes', 'editing', 'editing_changes', 'completed', 'uploaded'];

export const pipelineAnalyticsController = {
  async get(req: AuthRequest, res: Response): Promise<void> {
    try {
      const isAdmin = req.userRoles?.includes('admin') || req.userRole === 'admin';
      if (!isAdmin) {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const [statusDist, monthlyThroughput, stageDurations, totalsResult] = await Promise.all([
        query(`
          SELECT status, COUNT(*)::int as count
          FROM shorts
          GROUP BY status
        `),

        query(`
          WITH months AS (
            SELECT generate_series(
              DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
              DATE_TRUNC('month', NOW()),
              '1 month'::interval
            )::date as month
          ),
          created_by_month AS (
            SELECT DATE_TRUNC('month', created_at)::date as month, COUNT(*)::int as created
            FROM shorts
            WHERE created_at >= NOW() - INTERVAL '12 months'
            GROUP BY DATE_TRUNC('month', created_at)
          ),
          completed_by_month AS (
            SELECT DATE_TRUNC('month', editing_completed_at)::date as month, COUNT(*)::int as completed
            FROM shorts
            WHERE editing_completed_at IS NOT NULL
              AND editing_completed_at >= NOW() - INTERVAL '12 months'
            GROUP BY DATE_TRUNC('month', editing_completed_at)
          )
          SELECT
            TO_CHAR(m.month, 'Mon ''YY') as label,
            COALESCE(c.created, 0) as created,
            COALESCE(comp.completed, 0) as completed
          FROM months m
          LEFT JOIN created_by_month c ON c.month = m.month
          LEFT JOIN completed_by_month comp ON comp.month = m.month
          ORDER BY m.month
        `),

        query(`
          SELECT
            ROUND(AVG(EXTRACT(EPOCH FROM (clips_completed_at - created_at)) / 3600.0)::numeric, 1) as avg_hours_to_clips,
            ROUND(AVG(EXTRACT(EPOCH FROM (editing_completed_at - clips_completed_at)) / 3600.0)::numeric, 1) as avg_hours_editing,
            ROUND(AVG(EXTRACT(EPOCH FROM (editing_completed_at - created_at)) / 3600.0)::numeric, 1) as avg_total_hours
          FROM shorts
          WHERE clips_completed_at IS NOT NULL AND editing_completed_at IS NOT NULL
        `),

        query(`
          SELECT
            COUNT(*)::int as total,
            COUNT(CASE WHEN status NOT IN ('completed', 'uploaded') THEN 1 END)::int as in_progress,
            COUNT(CASE WHEN status IN ('completed', 'uploaded') THEN 1 END)::int as completed_all_time,
            COUNT(entered_clip_changes_at)::int as clip_revisions,
            COUNT(entered_editing_changes_at)::int as editing_revisions
          FROM shorts
        `),
      ]);

      const statusMap: Record<string, number> = {};
      statusDist.rows.forEach((r: any) => { statusMap[r.status] = r.count; });

      const statusDistribution = STATUS_ORDER.map(s => ({
        status: s,
        count: statusMap[s] || 0,
      }));

      const dur = stageDurations.rows[0] || {};
      const t = totalsResult.rows[0] || {};
      const total = parseInt(t.total || '0');
      const clipRevisions = parseInt(t.clip_revisions || '0');
      const editingRevisions = parseInt(t.editing_revisions || '0');

      res.json({
        status_distribution: statusDistribution,
        monthly_throughput: monthlyThroughput.rows.map((r: any) => ({
          label: r.label,
          created: parseInt(r.created),
          completed: parseInt(r.completed),
        })),
        stage_durations: {
          avg_hours_to_clips: dur.avg_hours_to_clips != null ? parseFloat(dur.avg_hours_to_clips) : null,
          avg_hours_editing: dur.avg_hours_editing != null ? parseFloat(dur.avg_hours_editing) : null,
          avg_total_hours: dur.avg_total_hours != null ? parseFloat(dur.avg_total_hours) : null,
        },
        totals: {
          total,
          in_progress: parseInt(t.in_progress || '0'),
          completed_all_time: parseInt(t.completed_all_time || '0'),
          clip_revision_rate: total > 0 ? Math.round((clipRevisions / total) * 100) : 0,
          editing_revision_rate: total > 0 ? Math.round((editingRevisions / total) * 100) : 0,
        },
      });
    } catch (error) {
      logger.error('Get pipeline analytics error', { error });
      res.status(500).json({ error: 'Failed to fetch pipeline analytics' });
    }
  },
};
