import { Response } from 'express';
import { getPool } from '../db';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL;
  return dbUrl?.startsWith('sqlite://') || false;
}

export const paymentsController = {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { user_id, month, year } = req.query;
      const db = getPool();
      const usingSqlite = isSqlite();
      
      let query = `
        SELECT p.*, 
               u.id as user_id, u.name as user_name, u.email as user_email, u.discord_username, u.profile_picture,
               s.id as short_id, s.title as short_title
        FROM payments p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN shorts s ON p.short_id = s.id
      `;
      
      const params: any[] = [];
      const conditions: string[] = [];
      let paramCount = 1;
      
      if (user_id) {
        if (usingSqlite) {
          conditions.push(`p.user_id = ?`);
        } else {
          conditions.push(`p.user_id = $${paramCount}`);
        }
        params.push(user_id);
        paramCount++;
      }
      
      if (month && year) {
        if (usingSqlite) {
          conditions.push(`strftime('%m', p.created_at) = ? AND strftime('%Y', p.created_at) = ?`);
        } else {
          conditions.push(`EXTRACT(MONTH FROM p.created_at) = $${paramCount} AND EXTRACT(YEAR FROM p.created_at) = $${paramCount + 1}`);
        }
        params.push(
          String(parseInt(month as string)).padStart(2, '0'),
          String(parseInt(year as string))
        );
        paramCount += 2;
      } else if (year) {
        if (usingSqlite) {
          conditions.push(`strftime('%Y', p.created_at) = ?`);
        } else {
          conditions.push(`EXTRACT(YEAR FROM p.created_at) = $${paramCount}`);
        }
        params.push(String(parseInt(year as string)));
        paramCount++;
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      query += ` ORDER BY p.created_at DESC`;
      
      const result = await db.query(query, params);
      
      // Format response with user and short objects
      const payments = result.rows.map((row: any) => ({
        ...row,
        user: row.user_id ? {
          id: row.user_id,
          name: row.user_name,
          email: row.user_email,
          discord_username: row.discord_username,
          profile_picture: row.profile_picture,
        } : undefined,
        short: row.short_id ? {
          id: row.short_id,
          title: row.short_title,
        } : undefined,
      }));
      
      res.json(payments);
    } catch (error) {
      logger.error('Get payments error', { error });
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  },

  async getPending(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { user_id, month, year } = req.query;
      const db = getPool();
      const usingSqlite = isSqlite();
      
      let query = `
        SELECT p.*, 
               u.id as user_id, u.name as user_name, u.email as user_email, u.paypal_email, u.discord_username, u.profile_picture,
               s.id as short_id, s.title as short_title
        FROM payments p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN shorts s ON p.short_id = s.id
        WHERE p.status = 'pending'
      `;
      
      const params: any[] = [];
      const conditions: string[] = [];
      let paramCount = 1;
      
      if (user_id) {
        if (usingSqlite) {
          conditions.push(`p.user_id = ?`);
        } else {
          conditions.push(`p.user_id = $${paramCount}`);
        }
        params.push(user_id);
        paramCount++;
      }
      
      if (month && year) {
        if (usingSqlite) {
          conditions.push(`strftime('%m', p.created_at) = ? AND strftime('%Y', p.created_at) = ?`);
        } else {
          conditions.push(`EXTRACT(MONTH FROM p.created_at) = $${paramCount} AND EXTRACT(YEAR FROM p.created_at) = $${paramCount + 1}`);
        }
        params.push(
          String(parseInt(month as string)).padStart(2, '0'),
          String(parseInt(year as string))
        );
        paramCount += 2;
      } else if (year) {
        if (usingSqlite) {
          conditions.push(`strftime('%Y', p.created_at) = ?`);
        } else {
          conditions.push(`EXTRACT(YEAR FROM p.created_at) = $${paramCount}`);
        }
        params.push(String(parseInt(year as string)));
        paramCount++;
      }
      
      if (conditions.length > 0) {
        query += ` AND ${conditions.join(' AND ')}`;
      }
      
      query += ` ORDER BY p.created_at DESC`;
      
      const result = await db.query(query, params);
      
      // Format response
      const payments = result.rows.map((row: any) => ({
        ...row,
        user: row.user_id ? {
          id: row.user_id,
          name: row.user_name,
          email: row.user_email,
          paypal_email: row.paypal_email,
          discord_username: row.discord_username,
          profile_picture: row.profile_picture,
        } : undefined,
        short: row.short_id ? {
          id: row.short_id,
          title: row.short_title,
        } : undefined,
      }));
      
      res.json(payments);
    } catch (error) {
      logger.error('Get pending payments error', { error });
      res.status(500).json({ error: 'Failed to fetch pending payments' });
    }
  },

  async getMyPayments(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      
      const { month, year } = req.query;
      const db = getPool();
      const usingSqlite = isSqlite();
      
      let query = `
        SELECT p.*, 
               s.id as short_id, s.title as short_title
         FROM payments p
         LEFT JOIN shorts s ON p.short_id = s.id
         WHERE p.user_id = ${usingSqlite ? '?' : '$1'}
      `;
      
      const params: any[] = [req.userId];
      let paramCount = 2;
      
      if (month && year) {
        if (usingSqlite) {
          query += ` AND strftime('%m', p.created_at) = ? AND strftime('%Y', p.created_at) = ?`;
        } else {
          query += ` AND EXTRACT(MONTH FROM p.created_at) = $${paramCount} AND EXTRACT(YEAR FROM p.created_at) = $${paramCount + 1}`;
        }
        params.push(
          String(parseInt(month as string)).padStart(2, '0'),
          String(parseInt(year as string))
        );
        paramCount += 2;
      } else if (year) {
        if (usingSqlite) {
          query += ` AND strftime('%Y', p.created_at) = ?`;
        } else {
          query += ` AND EXTRACT(YEAR FROM p.created_at) = $${paramCount}`;
        }
        params.push(String(parseInt(year as string)));
        paramCount++;
      }
      
      query += ` ORDER BY p.created_at DESC`;
      
      const result = await db.query(query, params);
      
      // Format response
      const payments = result.rows.map((row: any) => ({
        ...row,
        short: row.short_id ? {
          id: row.short_id,
          title: row.short_title,
        } : undefined,
      }));
      
      res.json(payments);
    } catch (error) {
      logger.error('Get my payments error', { userId: req.userId, error });
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  },

  async getById(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const db = getPool();
      
      const result = await db.query(
        `SELECT p.*, u.name as user_name, u.email as user_email, u.paypal_email, u.discord_username,
                s.title as short_title
         FROM payments p
         LEFT JOIN users u ON p.user_id = u.id
         LEFT JOIN shorts s ON p.short_id = s.id
         WHERE p.id = $1`,
        [id]
      );
      
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Get payment error', { paymentId: id, error });
      res.status(500).json({ error: 'Failed to fetch payment' });
    }
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { user_id, short_id, assignment_id, amount, role, rate_description, admin_notes, completed_at } = req.body;
      const db = getPool();
      
      const result = await db.query(
        `INSERT INTO payments (user_id, short_id, assignment_id, amount, role, rate_description, admin_notes, completed_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
         RETURNING *`,
        [
          user_id, 
          short_id || null, 
          assignment_id || null,
          amount, 
          role || null,
          rate_description || null,
          admin_notes || null,
          completed_at || null
        ]
      );
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      logger.error('Create payment error', { error });
      res.status(500).json({ error: 'Failed to create payment' });
    }
  },

  async update(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const { amount, admin_notes } = req.body;
      const db = getPool();
      
      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;
      
      if (amount !== undefined) {
        updates.push(`amount = $${paramCount++}`);
        params.push(amount);
      }
      if (admin_notes !== undefined) {
        updates.push(`admin_notes = $${paramCount++}`);
        params.push(admin_notes);
      }
      
      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }
      
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);
      
      const result = await db.query(
        `UPDATE payments SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        params
      );
      
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Update payment error', { paymentId: id, error });
      res.status(500).json({ error: 'Failed to update payment' });
    }
  },

  async markPaid(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const { paypal_transaction_link } = req.body;
      const db = getPool();
      
      if (!paypal_transaction_link) {
        res.status(400).json({ error: 'PayPal transaction link is required' });
        return;
      }
      
      const result = await db.query(
        `UPDATE payments 
         SET status = 'paid', paid_at = CURRENT_TIMESTAMP, paypal_transaction_link = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING *`,
        [id, paypal_transaction_link]
      );
      
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Mark paid error', { paymentId: id, error });
      res.status(500).json({ error: 'Failed to mark payment as paid' });
    }
  },

  async addIncentive(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { user_id, short_id, amount, description } = req.body;
      const db = getPool();
      
      if (!user_id || !amount) {
        res.status(400).json({ error: 'User ID and amount are required' });
        return;
      }
      
      const result = await db.query(
        `INSERT INTO payments (user_id, short_id, amount, admin_notes, status, role)
         VALUES ($1, $2, $3, $4, 'pending', 'incentive')
         RETURNING *`,
        [user_id, short_id || null, amount, description || null]
      );
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      logger.error('Add incentive error', { error });
      res.status(500).json({ error: 'Failed to add incentive payment' });
    }
  },

  async getStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { user_id, month, year } = req.query;
      const db = getPool();
      const usingSqlite = isSqlite();
      
      let dateFilter = '';
      const params: any[] = [];
      let paramCount = 1;
      
      if (month && year) {
        if (usingSqlite) {
          dateFilter = `AND strftime('%m', p.created_at) = ? AND strftime('%Y', p.created_at) = ?`;
        } else {
          dateFilter = `AND EXTRACT(MONTH FROM p.created_at) = $${paramCount++} AND EXTRACT(YEAR FROM p.created_at) = $${paramCount++}`;
        }
        params.push(
          String(parseInt(month as string)).padStart(2, '0'),
          String(parseInt(year as string))
        );
      } else if (year) {
        if (usingSqlite) {
          dateFilter = `AND strftime('%Y', p.created_at) = ?`;
        } else {
          dateFilter = `AND EXTRACT(YEAR FROM p.created_at) = $${paramCount++}`;
        }
        params.push(String(parseInt(year as string)));
      }
      
      if (user_id) {
        const userId = parseInt(user_id as string);
        
        // Build date filter for assignments (different table)
        let assignmentDateFilter = '';
        if (month && year) {
          if (usingSqlite) {
            assignmentDateFilter = `AND strftime('%m', completed_at) = ? AND strftime('%Y', completed_at) = ?`;
          } else {
            assignmentDateFilter = `AND EXTRACT(MONTH FROM completed_at) = $${paramCount} AND EXTRACT(YEAR FROM completed_at) = $${paramCount + 1}`;
          }
        } else if (year) {
          if (usingSqlite) {
            assignmentDateFilter = `AND strftime('%Y', completed_at) = ?`;
          } else {
            assignmentDateFilter = `AND EXTRACT(YEAR FROM completed_at) = $${paramCount}`;
          }
        }
        
        // User stats - build queries with proper parameter placeholders
        let totalEarnedQuery: string;
        let totalPendingQuery: string;
        let clipsQuery: string;
        let editsQuery: string;
        const queryParams: any[] = [userId];
        
        if (usingSqlite) {
          totalEarnedQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE user_id = ? AND status = 'paid'${dateFilter}`;
          totalPendingQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE user_id = ? AND status = 'pending'${dateFilter}`;
          clipsQuery = `SELECT COUNT(DISTINCT short_id) as count FROM assignments WHERE user_id = ? AND role = 'clipper' AND completed_at IS NOT NULL${assignmentDateFilter}`;
          editsQuery = `SELECT COUNT(DISTINCT short_id) as count FROM assignments WHERE user_id = ? AND role = 'editor' AND completed_at IS NOT NULL${assignmentDateFilter}`;
          queryParams.push(...params);
        } else {
          totalEarnedQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE user_id = $1 AND status = 'paid'${dateFilter}`;
          totalPendingQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE user_id = $1 AND status = 'pending'${dateFilter}`;
          clipsQuery = `SELECT COUNT(DISTINCT short_id) as count FROM assignments WHERE user_id = $1 AND role = 'clipper' AND completed_at IS NOT NULL${assignmentDateFilter}`;
          editsQuery = `SELECT COUNT(DISTINCT short_id) as count FROM assignments WHERE user_id = $1 AND role = 'editor' AND completed_at IS NOT NULL${assignmentDateFilter}`;
          queryParams.push(...params);
        }
        
        const totalEarned = await db.query(totalEarnedQuery, queryParams);
        const totalPending = await db.query(totalPendingQuery, queryParams);
        const clipsCompleted = await db.query(clipsQuery, queryParams);
        const editsCompleted = await db.query(editsQuery, queryParams);
        
        res.json({
          total_earned: parseFloat(totalEarned.rows[0]?.total || 0),
          total_pending: parseFloat(totalPending.rows[0]?.total || 0),
          clips_completed: parseInt(clipsCompleted.rows[0]?.count || 0),
          edits_completed: parseInt(editsCompleted.rows[0]?.count || 0),
        });
      } else {
        // Admin stats
        let totalPaidQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'paid'`;
        let totalPendingQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'pending'`;
        let videosQuery = `SELECT COUNT(*) as count FROM shorts WHERE status = 'uploaded'`;
        
        if (dateFilter) {
          totalPaidQuery += dateFilter;
          totalPendingQuery += dateFilter;
          if (usingSqlite) {
            videosQuery += dateFilter.replace('p.created_at', 'updated_at');
          } else {
            videosQuery += dateFilter.replace('p.created_at', 's.updated_at');
          }
        }
        
        const totalPaid = await db.query(totalPaidQuery, params);
        const totalPending = await db.query(totalPendingQuery, params);
        const videosPosted = await db.query(videosQuery, params);
        
        res.json({
          total_paid: parseFloat(totalPaid.rows[0]?.total || 0),
          total_pending: parseFloat(totalPending.rows[0]?.total || 0),
          videos_posted: parseInt(videosPosted.rows[0]?.count || 0),
        });
      }
    } catch (error) {
      logger.error('Get stats error', { error });
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  }
};

