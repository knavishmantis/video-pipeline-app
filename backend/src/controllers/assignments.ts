import { Response } from 'express';
import { getPool } from '../db';
import { AuthRequest } from '../middleware/auth';
import { CreateAssignmentInput } from '../../../shared/types';

export const assignmentsController = {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const isAdmin = req.userRoles?.includes('admin') || req.userRole === 'admin';
      if (!isAdmin) {
        res.status(403).json({ error: 'Only admins can view all assignments' });
        return;
      }

      const db = getPool();
      const result = await db.query(
        `SELECT a.*
         FROM assignments a
         ORDER BY a.due_date ASC NULLS LAST`
      );
      
      // Populate user data for each assignment
      const assignmentsWithUsers = await Promise.all(
        result.rows.map(async (assignment: any) => {
          if (assignment.user_id) {
            const userResult = await db.query(
              'SELECT id, email, name, discord_username, profile_picture FROM users WHERE id = $1',
              [assignment.user_id]
            );
            if (userResult.rows.length > 0) {
              assignment.user = userResult.rows[0];
            }
          }
          return assignment;
        })
      );
      
      res.json(assignmentsWithUsers);
    } catch (error) {
      console.error('Get assignments error:', error);
      res.status(500).json({ error: 'Failed to fetch assignments' });
    }
  },

  async getMyAssignments(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const db = getPool();
      const result = await db.query(
        `SELECT a.*
         FROM assignments a
         WHERE a.user_id = $1
         ORDER BY a.due_date ASC NULLS LAST`,
        [req.userId]
      );
      
      // Populate user data for each assignment
      const assignmentsWithUsers = await Promise.all(
        result.rows.map(async (assignment: any) => {
          if (assignment.user_id) {
            const userResult = await db.query(
              'SELECT id, email, name, discord_username, profile_picture FROM users WHERE id = $1',
              [assignment.user_id]
            );
            if (userResult.rows.length > 0) {
              assignment.user = userResult.rows[0];
            }
          }
          return assignment;
        })
      );
      
      res.json(assignmentsWithUsers);
    } catch (error) {
      console.error('Get my assignments error:', error);
      res.status(500).json({ error: 'Failed to fetch assignments' });
    }
  },

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const isAdmin = req.userRoles?.includes('admin') || req.userRole === 'admin';
      if (!isAdmin) {
        res.status(403).json({ error: 'Only admins can view assignment details' });
        return;
      }

      const { id } = req.params;
      const db = getPool();
      
      const result = await db.query(
        `SELECT a.*, u.name as user_name, u.email as user_email, s.title as short_title
         FROM assignments a
         LEFT JOIN users u ON a.user_id = u.id
         LEFT JOIN shorts s ON a.short_id = s.id
         WHERE a.id = $1`,
        [id]
      );
      
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Assignment not found' });
        return;
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Get assignment error:', error);
      res.status(500).json({ error: 'Failed to fetch assignment' });
    }
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const isAdmin = req.userRoles?.includes('admin') || req.userRole === 'admin';
      if (!isAdmin) {
        res.status(403).json({ error: 'Only admins can create assignments' });
        return;
      }

      const input: CreateAssignmentInput = req.body;
      const db = getPool();
      
      const result = await db.query(
        `INSERT INTO assignments (short_id, user_id, role, due_date, default_time_range, rate, rate_description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          input.short_id,
          input.user_id,
          input.role,
          input.due_date || null,
          input.default_time_range || 2,
          input.rate || null,
          input.rate_description || null
        ]
      );
      
      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        res.status(409).json({ error: 'Assignment already exists for this short and role' });
      } else {
        console.error('Create assignment error:', error);
        res.status(500).json({ error: 'Failed to create assignment' });
      }
    }
  },

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const isAdmin = req.userRoles?.includes('admin') || req.userRole === 'admin';
      if (!isAdmin) {
        res.status(403).json({ error: 'Only admins can update assignments' });
        return;
      }

      const { id } = req.params;
      const { due_date, default_time_range, rate, rate_description } = req.body;
      const db = getPool();
      
      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;
      
      if (due_date !== undefined) {
        updates.push(`due_date = $${paramCount++}`);
        params.push(due_date || null);
      }
      if (default_time_range !== undefined) {
        updates.push(`default_time_range = $${paramCount++}`);
        params.push(default_time_range);
      }
      if (rate !== undefined) {
        updates.push(`rate = $${paramCount++}`);
        params.push(rate || null);
      }
      if (rate_description !== undefined) {
        updates.push(`rate_description = $${paramCount++}`);
        params.push(rate_description || null);
      }
      
      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }
      
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);
      
      const result = await db.query(
        `UPDATE assignments SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        params
      );
      
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Assignment not found' });
        return;
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update assignment error:', error);
      res.status(500).json({ error: 'Failed to update assignment' });
    }
  },

  async markComplete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const isAdmin = req.userRoles?.includes('admin') || req.userRole === 'admin';
      if (!isAdmin) {
        res.status(403).json({ error: 'Only admins can mark assignments as complete' });
        return;
      }

      const { id } = req.params;
      const db = getPool();
      
      // Get assignment with rate info
      const assignmentResult = await db.query(
        `SELECT * FROM assignments WHERE id = $1`,
        [id]
      );
      
      if (assignmentResult.rows.length === 0) {
        res.status(404).json({ error: 'Assignment not found' });
        return;
      }
      
      const assignment = assignmentResult.rows[0];
      
      // Update assignment to completed
      const result = await db.query(
        `UPDATE assignments 
         SET completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING *`,
        [id]
      );
      
      // Auto-create payment if rate is set
      if (assignment.rate && assignment.rate > 0) {
        // Check if payment already exists for this assignment
        const existingPayment = await db.query(
          `SELECT id FROM payments WHERE assignment_id = $1`,
          [id]
        );
        
        if (existingPayment.rows.length === 0) {
          await db.query(
            `INSERT INTO payments (user_id, short_id, assignment_id, amount, role, rate_description, completed_at, status)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, 'pending')`,
            [
              assignment.user_id,
              assignment.short_id,
              assignment.id,
              assignment.rate,
              assignment.role,
              assignment.rate_description || null
            ]
          );
        }
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Mark complete error:', error);
      res.status(500).json({ error: 'Failed to mark assignment complete' });
    }
  },

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const isAdmin = req.userRoles?.includes('admin') || req.userRole === 'admin';
      if (!isAdmin) {
        res.status(403).json({ error: 'Only admins can delete assignments' });
        return;
      }

      const { id } = req.params;
      const db = getPool();
      
      const result = await db.query('DELETE FROM assignments WHERE id = $1 RETURNING id', [id]);
      
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Assignment not found' });
        return;
      }
      
      res.json({ message: 'Assignment deleted successfully' });
    } catch (error) {
      console.error('Delete assignment error:', error);
      res.status(500).json({ error: 'Failed to delete assignment' });
    }
  }
};

