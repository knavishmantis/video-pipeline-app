import { Response } from 'express';
import multer from 'multer';
import { getPool } from '../db';
import { AuthRequest } from '../middleware/auth';
import { uploadFile, getSignedUrl, deleteFile } from '../services/gcpStorage';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
});

export const filesController = {
  upload: [
    upload.single('file'),
    async (req: AuthRequest, res: Response): Promise<void> => {
      try {
        if (!req.file || !req.userId) {
          res.status(400).json({ error: 'File and authentication required' });
          return;
        }

        const { short_id, file_type, user_id } = req.body;
        
        if (!file_type) {
          res.status(400).json({ error: 'file_type required' });
          return;
        }

        // For profile pictures, user_id is required instead of short_id
        if (file_type === 'profile_picture') {
          if (!user_id || parseInt(user_id) !== req.userId) {
            res.status(403).json({ error: 'You can only upload your own profile picture' });
            return;
          }
        } else {
          if (!short_id) {
            res.status(400).json({ error: 'short_id required for non-profile files' });
            return;
          }
        }

        const db = getPool();
        const bucketPath = file_type === 'profile_picture'
          ? await uploadFile(req.file, undefined, file_type, req.userId, parseInt(user_id))
          : await uploadFile(req.file, parseInt(short_id), file_type, req.userId);
        
        // For profile pictures, return the URL directly (don't store in files table)
        if (file_type === 'profile_picture') {
          const { getSignedUrl } = await import('../services/gcpStorage');
          const url = await getSignedUrl(bucketPath, 31536000); // 1 year expiry for profile pictures
          res.status(201).json({ gcp_bucket_path: bucketPath, url });
          return;
        }
        
        const result = await db.query(
          `INSERT INTO files (short_id, file_type, gcp_bucket_path, file_name, file_size, mime_type, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            short_id,
            file_type,
            bucketPath,
            req.file.originalname,
            req.file.size,
            req.file.mimetype,
            req.userId
          ]
        );
        
        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error('Upload file error:', error);
        res.status(500).json({ error: 'Failed to upload file' });
      }
    }
  ],

  async getByShortId(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { shortId } = req.params;
      const db = getPool();
      
      const result = await db.query(
        `SELECT f.*, u.name as uploader_name
         FROM files f
         LEFT JOIN users u ON f.uploaded_by = u.id
         WHERE f.short_id = $1
         ORDER BY f.file_type, f.uploaded_at DESC`,
        [shortId]
      );
      
      // Get signed URLs for each file
      const filesWithUrls = await Promise.all(
        result.rows.map(async (file) => {
          try {
            const url = await getSignedUrl(file.gcp_bucket_path);
            return { ...file, download_url: url };
          } catch (error) {
            console.error(`Failed to get signed URL for file ${file.id}:`, error);
            return { ...file, download_url: null };
          }
        })
      );
      
      res.json(filesWithUrls);
    } catch (error) {
      console.error('Get files error:', error);
      res.status(500).json({ error: 'Failed to fetch files' });
    }
  },

  async download(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const db = getPool();
      
      const result = await db.query('SELECT * FROM files WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      
      const file = result.rows[0];
      const url = await getSignedUrl(file.gcp_bucket_path, 3600); // 1 hour expiry
      
      res.json({ download_url: url });
    } catch (error) {
      console.error('Download file error:', error);
      res.status(500).json({ error: 'Failed to generate download URL' });
    }
  },

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const db = getPool();
      
      const result = await db.query('SELECT * FROM files WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      
      const file = result.rows[0];
      
      // Delete from GCP
      await deleteFile(file.gcp_bucket_path);
      
      // Delete from database
      await db.query('DELETE FROM files WHERE id = $1', [id]);
      
      res.json({ message: 'File deleted successfully' });
    } catch (error) {
      console.error('Delete file error:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  }
};

