import { Response } from 'express';
import { getPool } from '../db';
import { AuthRequest } from '../middleware/auth';

export const paymentsController = {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { user_id } = req.query;
      const db = getPool();
      
      let query = `
        SELECT p.*, 
               u.id as user_id, u.name as user_name, u.email as user_email, u.discord_username, u.profile_picture,
               s.id as short_id, s.title as short_title
        FROM payments p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN shorts s ON p.short_id = s.id
      `;
      
      const params: any[] = [];
      if (user_id) {
        query += ` WHERE p.user_id = $1`;
        params.push(user_id);
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
      console.error('Get payments error:', error);
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  },

  async getPending(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { user_id } = req.query;
      const db = getPool();
      
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
      if (user_id) {
        query += ` AND p.user_id = $1`;
        params.push(user_id);
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
      console.error('Get pending payments error:', error);
      res.status(500).json({ error: 'Failed to fetch pending payments' });
    }
  },

  async getMyPayments(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      
      const db = getPool();
      const result = await db.query(
        `SELECT p.*, 
               s.id as short_id, s.title as short_title
         FROM payments p
         LEFT JOIN shorts s ON p.short_id = s.id
         WHERE p.user_id = $1
         ORDER BY p.created_at DESC`,
        [req.userId]
      );
      
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
      console.error('Get my payments error:', error);
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  },

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
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
      console.error('Get payment error:', error);
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
      console.error('Create payment error:', error);
      res.status(500).json({ error: 'Failed to create payment' });
    }
  },

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
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
      console.error('Update payment error:', error);
      res.status(500).json({ error: 'Failed to update payment' });
    }
  },

  async markPaid(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const db = getPool();
      
      const result = await db.query(
        `UPDATE payments 
         SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING *`,
        [id]
      );
      
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Mark paid error:', error);
      res.status(500).json({ error: 'Failed to mark payment as paid' });
    }
  }
};

