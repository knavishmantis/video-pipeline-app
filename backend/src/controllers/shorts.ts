import { Response } from 'express';
import { query } from '../db';
import { AuthRequest } from '../middleware/auth';
import { Short, CreateShortInput, UpdateShortInput } from '../../../shared/types';
import { getSignedUrl } from '../services/gcpStorage';

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
      
      // Get script writers and files for each short
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
          
          // Get files for this short
          const filesResult = await query(
            'SELECT id, file_type, file_name, gcp_bucket_path, file_size, uploaded_at FROM files WHERE short_id = $1',
            [short.id]
          );
          
          // Add entered_clip_changes_at and entered_editing_changes_at to short for frontend
          const shortWithTimestamps = await query(
            'SELECT entered_clip_changes_at, entered_editing_changes_at FROM shorts WHERE id = $1',
            [short.id]
          );
          if (shortWithTimestamps.rows.length > 0) {
            short.entered_clip_changes_at = shortWithTimestamps.rows[0].entered_clip_changes_at;
            short.entered_editing_changes_at = shortWithTimestamps.rows[0].entered_editing_changes_at;
          }
          
          // Generate download URLs for each file
          const filesWithUrls = await Promise.all(
            filesResult.rows.map(async (file: any) => {
              try {
                if (file.gcp_bucket_path) {
                  const url = await getSignedUrl(file.gcp_bucket_path, 3600); // 1 hour expiry
                  return { ...file, download_url: url };
                }
                return { ...file, download_url: null };
              } catch (error) {
                console.error(`Failed to get signed URL for file ${file.id}:`, error);
                return { ...file, download_url: null };
              }
            })
          );
          
          short.files = filesWithUrls;
          
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
      
      // Get script writers and files for each short
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
          
          // Get files for this short
          const filesResult = await query(
            'SELECT id, file_type, file_name, gcp_bucket_path, file_size, uploaded_at FROM files WHERE short_id = $1',
            [short.id]
          );
          
          // Add entered_clip_changes_at and entered_editing_changes_at to short for frontend
          const shortWithTimestamps = await query(
            'SELECT entered_clip_changes_at, entered_editing_changes_at FROM shorts WHERE id = $1',
            [short.id]
          );
          if (shortWithTimestamps.rows.length > 0) {
            short.entered_clip_changes_at = shortWithTimestamps.rows[0].entered_clip_changes_at;
            short.entered_editing_changes_at = shortWithTimestamps.rows[0].entered_editing_changes_at;
          }
          
          // Generate download URLs for each file
          const filesWithUrls = await Promise.all(
            filesResult.rows.map(async (file: any) => {
              try {
                if (file.gcp_bucket_path) {
                  const url = await getSignedUrl(file.gcp_bucket_path, 3600); // 1 hour expiry
                  return { ...file, download_url: url };
                }
                return { ...file, download_url: null };
              } catch (error) {
                console.error(`Failed to get signed URL for file ${file.id}:`, error);
                return { ...file, download_url: null };
              }
            })
          );
          
          short.files = filesWithUrls;
          
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
        `SELECT s.*, s.entered_clip_changes_at, s.entered_editing_changes_at
         FROM shorts s
         WHERE s.id = $1`,
        [id]
      );
      
      if (shortResult.rows.length === 0) {
        res.status(404).json({ error: 'Short not found' });
        return;
      }
      
      const short = shortResult.rows[0];
      
      // Ensure user is authenticated
      if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }
      
      // Get user roles if not already set
      let userRoles = req.userRoles;
      if (!userRoles || userRoles.length === 0) {
        try {
          const rolesResult = await query(
            'SELECT role FROM user_roles WHERE user_id = $1',
            [req.userId]
          );
          userRoles = rolesResult.rows.map((r: any) => r.role);
        } catch (error) {
          userRoles = [];
        }
      }
      
      // Only admins can view the detail page
      const isAdmin = userRoles?.includes('admin');
      
      if (!isAdmin) {
        console.log('Access denied - admin only');
        res.status(403).json({ error: 'You do not have permission to view this short. Admin access required.' });
        return;
      }
      
      console.log('Access granted - admin user, loading full short data');
      
      // Get assignments to populate data
      const assignmentsResult = await query(
        `SELECT a.*
         FROM assignments a
         WHERE a.short_id = $1`,
        [id]
      );
      
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
      
      // Generate download URLs for each file
      const filesWithUrls = await Promise.all(
        filesResult.rows.map(async (file: any) => {
          try {
            if (file.gcp_bucket_path) {
              const url = await getSignedUrl(file.gcp_bucket_path, 3600); // 1 hour expiry
              return { ...file, download_url: url };
            }
            return { ...file, download_url: null };
          } catch (error) {
            console.error(`Failed to get signed URL for file ${file.id}:`, error);
            return { ...file, download_url: null };
          }
        })
      );
      
      short.assignments = assignmentsWithUsers;
      short.files = filesWithUrls;
      
      res.json(short);
    } catch (error) {
      console.error('Get short error:', error);
      res.status(500).json({ error: 'Failed to fetch short' });
    }
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const isAdmin = req.userRoles?.includes('admin');
      if (!isAdmin) {
        res.status(403).json({ error: 'Only admins can create shorts' });
        return;
      }

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
      const isAdmin = req.userRoles?.includes('admin');
      if (!isAdmin) {
        res.status(403).json({ error: 'Only admins can update shorts' });
        return;
      }

      const { id } = req.params;
      const input: UpdateShortInput = req.body;
      
      // If updating status, validate file requirements
      if (input.status !== undefined) {
        const shortResult = await query(
          `SELECT s.* FROM shorts s WHERE s.id = $1`,
          [id]
        );
        
        if (shortResult.rows.length === 0) {
          res.status(404).json({ error: 'Short not found' });
          return;
        }
        
        const short = shortResult.rows[0];
        
        // Get files for this short
        const filesResult = await query(
          `SELECT * FROM files WHERE short_id = $1`,
          [id]
        );
        const files = filesResult.rows;
        
        // Validate file requirements and completion status based on target status
        if (input.status === 'clipping' || input.status === 'clips') {
          const hasScript = files.some((f: any) => f.file_type === 'script' || f.file_type === 'script_pdf');
          const hasAudio = files.some((f: any) => f.file_type === 'audio');
          if (!hasScript) {
            res.status(400).json({ 
              error: 'Cannot move to clipping stage. Required: script PDF' 
            });
            return;
          }
          if (!hasAudio) {
            res.status(400).json({ 
              error: 'Cannot move to clipping stage. Required: audio MP3' 
            });
            return;
          }
        } else if (input.status === 'editing' || input.status === 'editing_changes') {
          // Check if clips are completed before allowing move to editing
          if (!short.clips_completed_at) {
            res.status(400).json({ 
              error: 'Cannot move to editing stage. Clips must be marked as complete first.' 
            });
            return;
          }
          const hasClipsZip = files.some((f: any) => f.file_type === 'clips_zip');
          if (!hasClipsZip) {
            res.status(400).json({ 
              error: 'Cannot move to editing stage. Required: zipped file containing all clips' 
            });
            return;
          }
        } else if (input.status === 'ready_to_upload') {
          // Check if editing is completed before allowing move to ready_to_upload
          if (!short.editing_completed_at) {
            res.status(400).json({ 
              error: 'Cannot move to ready to upload. Editing must be marked as complete first.' 
            });
            return;
          }
          const hasFinalVideo = files.some((f: any) => f.file_type === 'final_video');
          if (!hasFinalVideo) {
            res.status(400).json({ 
              error: 'Cannot move to ready to upload. Required: final video MP4' 
            });
            return;
          }
        }
      }
      
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

  async markClipsComplete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Get short with files
      const shortResult = await query(
        `SELECT s.* FROM shorts s WHERE s.id = $1`,
        [id]
      );
      
      if (shortResult.rows.length === 0) {
        res.status(404).json({ error: 'Short not found' });
        return;
      }
      
      const short = shortResult.rows[0];
      
      // Check if short is in clips stage
      if (short.status !== 'clips' && short.status !== 'clip_changes') {
        res.status(400).json({ error: 'Short must be in clips stage to mark as complete' });
        return;
      }
      
      // Get files
      const filesResult = await query(
        `SELECT * FROM files WHERE short_id = $1`,
        [id]
      );
      const files = filesResult.rows;
      
      // Check for clips zip
      const hasClipsZip = files.some((f: any) => f.file_type === 'clips_zip');
      if (!hasClipsZip) {
        res.status(400).json({ error: 'Cannot mark clips complete. Required: zipped file containing all clips' });
        return;
      }
      
      // Get clipper assignment for this short
      const clipperAssignment = await query(
        `SELECT * FROM assignments WHERE short_id = $1 AND role = 'clipper'`,
        [id]
      );
      
      // Require assignment with rate before marking complete
      if (clipperAssignment.rows.length === 0) {
        res.status(400).json({ error: 'Cannot mark clips complete. No clipper assignment found for this short.' });
        return;
      }
      
      const assignment = clipperAssignment.rows[0];
      if (!assignment.rate || assignment.rate <= 0) {
        res.status(400).json({ error: 'Cannot mark clips complete. Rate must be set for the clipper assignment before marking complete.' });
        return;
      }
      
      // Update short to mark clips as complete (only after validation passes)
      await query(
        `UPDATE shorts SET clips_completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
      );
      
      // Check if payment already exists for this short and role (to prevent duplicates)
      const existingPayment = await query(
        `SELECT id FROM payments WHERE short_id = $1 AND role = 'clipper'`,
        [id]
      );
      
      let paymentId: number | null = null;
      
      if (existingPayment.rows.length === 0) {
        // Create payment for clipper
        const paymentResult = await query(
          `INSERT INTO payments (user_id, short_id, assignment_id, amount, role, rate_description, completed_at, status)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, 'pending')
           RETURNING id`,
          [
            assignment.user_id,
            assignment.short_id,
            assignment.id,
            assignment.rate,
            'clipper',
            assignment.rate_description || null
          ]
        );
        paymentId = paymentResult.rows[0].id;
        console.log('Payment created:', paymentId);
      } else {
        paymentId = existingPayment.rows[0].id;
        console.log('Payment already exists:', paymentId);
      }
      
      // Verify payment was created/exists
      if (!paymentId) {
        res.status(500).json({ error: 'Failed to create payment. Cannot mark clips complete.' });
        return;
      }
      
      // Return updated short
      const updatedShort = await query(
        `SELECT * FROM shorts WHERE id = $1`,
        [id]
      );
      
      res.json(updatedShort.rows[0]);
    } catch (error) {
      console.error('Mark clips complete error:', error);
      res.status(500).json({ error: 'Failed to mark clips complete' });
    }
  },

  async markEditingComplete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Get short with files
      const shortResult = await query(
        `SELECT s.* FROM shorts s WHERE s.id = $1`,
        [id]
      );
      
      if (shortResult.rows.length === 0) {
        res.status(404).json({ error: 'Short not found' });
        return;
      }
      
      const short = shortResult.rows[0];
      
      // Check if short is in editing stage
      if (short.status !== 'editing' && short.status !== 'editing_changes') {
        res.status(400).json({ error: 'Short must be in editing stage to mark as complete' });
        return;
      }
      
      // Get files
      const filesResult = await query(
        `SELECT * FROM files WHERE short_id = $1`,
        [id]
      );
      const files = filesResult.rows;
      
      // Check for final video
      const hasFinalVideo = files.some((f: any) => f.file_type === 'final_video');
      if (!hasFinalVideo) {
        res.status(400).json({ error: 'Cannot mark editing complete. Required: final video MP4' });
        return;
      }
      
      // Get editor assignment for this short
      const editorAssignment = await query(
        `SELECT * FROM assignments WHERE short_id = $1 AND role = 'editor'`,
        [id]
      );
      
      // Require assignment with rate before marking complete
      if (editorAssignment.rows.length === 0) {
        res.status(400).json({ error: 'Cannot mark editing complete. No editor assignment found for this short.' });
        return;
      }
      
      const assignment = editorAssignment.rows[0];
      if (!assignment.rate || assignment.rate <= 0) {
        res.status(400).json({ error: 'Cannot mark editing complete. Rate must be set for the editor assignment before marking complete.' });
        return;
      }
      
      // Update short to mark editing as complete (only after validation passes)
      await query(
        `UPDATE shorts SET editing_completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
      );
      
      // Check if payment already exists for this short and role (to prevent duplicates)
      const existingPayment = await query(
        `SELECT id FROM payments WHERE short_id = $1 AND role = 'editor'`,
        [id]
      );
      
      let paymentId: number | null = null;
      
      if (existingPayment.rows.length === 0) {
        // Create payment for editor
        const paymentResult = await query(
          `INSERT INTO payments (user_id, short_id, assignment_id, amount, role, rate_description, completed_at, status)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, 'pending')
           RETURNING id`,
          [
            assignment.user_id,
            assignment.short_id,
            assignment.id,
            assignment.rate,
            'editor',
            assignment.rate_description || null
          ]
        );
        paymentId = paymentResult.rows[0].id;
        console.log('Payment created:', paymentId);
      } else {
        paymentId = existingPayment.rows[0].id;
        console.log('Payment already exists:', paymentId);
      }
      
      // Verify payment was created/exists
      if (!paymentId) {
        res.status(500).json({ error: 'Failed to create payment. Cannot mark editing complete.' });
        return;
      }
      
      // Return updated short
      const updatedShort = await query(
        `SELECT * FROM shorts WHERE id = $1`,
        [id]
      );
      
      res.json(updatedShort.rows[0]);
    } catch (error) {
      console.error('Mark editing complete error:', error);
      res.status(500).json({ error: 'Failed to mark editing complete' });
    }
  },

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const isAdmin = req.userRoles?.includes('admin');
      if (!isAdmin) {
        res.status(403).json({ error: 'Only admins can delete shorts' });
        return;
      }

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

