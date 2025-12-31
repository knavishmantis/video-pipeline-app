import { Response } from 'express';
import { query } from '../db';
import { AuthRequest } from '../middleware/auth';
import { Short, CreateShortInput, UpdateShortInput } from '../../../shared/types';

export const shortsController = {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { status, assigned } = req.query;
      
      let sqlQuery = `
        SELECT s.*
        FROM shorts s
      `;
      const params: any[] = [];
      
      if (status) {
        sqlQuery += ` WHERE s.status = $${params.length + 1}`;
        params.push(status);
      }
      
      if (assigned === 'true' && req.userId) {
        sqlQuery += status ? ' AND' : ' WHERE';
        sqlQuery += ` EXISTS (
          SELECT 1 FROM assignments a 
          WHERE a.short_id = s.id AND a.user_id = $${params.length + 1}
        )`;
        params.push(req.userId);
      }
      
      sqlQuery += ' ORDER BY s.created_at DESC';
      
      const result = await query(sqlQuery, params);
      
      // Get script writers for each short
      const shortsWithWriters = await Promise.all(
        result.rows.map(async (short: any) => {
          if (short.script_writer_id) {
            const writerResult = await query(
              'SELECT id, email, name FROM users WHERE id = $1',
              [short.script_writer_id]
            );
            if (writerResult.rows.length > 0) {
              short.script_writer = writerResult.rows[0];
            }
          }
          return short;
        })
      );
      
      res.json(shortsWithWriters);
    } catch (error) {
      console.error('Get shorts error:', error);
      res.status(500).json({ error: 'Failed to fetch shorts' });
    }
  },

  async getAssigned(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const result = await query(
        `SELECT s.*, a.role, a.due_date, a.completed_at
         FROM shorts s
         INNER JOIN assignments a ON s.id = a.short_id
         WHERE a.user_id = $1
         ORDER BY a.due_date ASC NULLS LAST, s.created_at DESC`,
        [req.userId]
      );
      
      // Get script writers for each short
      const shortsWithWriters = await Promise.all(
        result.rows.map(async (short: any) => {
          if (short.script_writer_id) {
            const writerResult = await query(
              'SELECT id, email, name FROM users WHERE id = $1',
              [short.script_writer_id]
            );
            if (writerResult.rows.length > 0) {
              short.script_writer = writerResult.rows[0];
            }
          }
          return short;
        })
      );
      
      res.json(shortsWithWriters);
    } catch (error) {
      console.error('Get assigned shorts error:', error);
      res.status(500).json({ error: 'Failed to fetch assigned shorts' });
    }
  },

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Get short
      const shortResult = await query(
        `SELECT s.*
         FROM shorts s
         WHERE s.id = $1`,
        [id]
      );
      
      if (shortResult.rows.length === 0) {
        res.status(404).json({ error: 'Short not found' });
        return;
      }
      
      const short = shortResult.rows[0];
      
      // Get script writer
      if (short.script_writer_id) {
        const writerResult = await query(
          'SELECT id, email, name FROM users WHERE id = $1',
          [short.script_writer_id]
        );
        if (writerResult.rows.length > 0) {
          short.script_writer = writerResult.rows[0];
        }
      }
      
      // Get assignments with full user objects
      const assignmentsResult = await query(
        `SELECT a.*
         FROM assignments a
         WHERE a.short_id = $1`,
        [id]
      );
      
      // Populate user data for each assignment
      const assignmentsWithUsers = await Promise.all(
        assignmentsResult.rows.map(async (assignment: any) => {
          if (assignment.user_id) {
            const userResult = await query(
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
      
      // Get files
      const filesResult = await query(
        `SELECT f.*, u.name as uploader_name
         FROM files f
         LEFT JOIN users u ON f.uploaded_by = u.id
         WHERE f.short_id = $1
         ORDER BY f.file_type, f.uploaded_at DESC`,
        [id]
      );
      
      short.assignments = assignmentsWithUsers;
      short.files = filesResult.rows;
      
      res.json(short);
    } catch (error) {
      console.error('Get short error:', error);
      res.status(500).json({ error: 'Failed to fetch short' });
    }
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const input: CreateShortInput = req.body;
      
      const result = await query(
        'INSERT INTO shorts (title, description, idea, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [input.title, input.description || null, input.idea || null, 'idea']
      );
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Create short error:', error);
      res.status(500).json({ error: 'Failed to create short' });
    }
  },

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const input: UpdateShortInput = req.body;
      
      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;
      
      if (input.title !== undefined) {
        updates.push(`title = $${paramCount++}`);
        params.push(input.title);
      }
      if (input.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        params.push(input.description);
      }
      if (input.idea !== undefined) {
        updates.push(`idea = $${paramCount++}`);
        params.push(input.idea);
      }
      if (input.script_content !== undefined) {
        updates.push(`script_content = $${paramCount++}`);
        params.push(input.script_content);
      }
      if (input.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        params.push(input.status);
      }
      if (input.script_writer_id !== undefined) {
        updates.push(`script_writer_id = $${paramCount++}`);
        params.push(input.script_writer_id);
      }
      
      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }
      
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);
      
      const result = await query(
        `UPDATE shorts SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        params
      );
      
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Short not found' });
        return;
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update short error:', error);
      res.status(500).json({ error: 'Failed to update short' });
    }
  },

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const result = await query('DELETE FROM shorts WHERE id = $1 RETURNING id', [id]);
      
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Short not found' });
        return;
      }
      
      res.json({ message: 'Short deleted successfully' });
    } catch (error) {
      console.error('Delete short error:', error);
      res.status(500).json({ error: 'Failed to delete short' });
    }
  }
};

