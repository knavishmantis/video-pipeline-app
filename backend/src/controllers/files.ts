import { Response } from 'express';
import multer from 'multer';
import { getPool } from '../db';
import { AuthRequest } from '../middleware/auth';
import { uploadFile, getSignedUrl, getSignedUploadUrl, deleteFile, generateBucketPath } from '../services/gcpStorage';
import { logger } from '../utils/logger';

// Configure multer for memory storage
// Note: For clips (10GB), we'll use a separate upload handler
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB default (for script, audio, final video)
  },
});

// Separate multer config for large clip files (10GB)
const uploadLarge = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB for clips
  },
});

export const filesController = {
  upload: [
    // Use large upload (10GB) for all files to support large clips
    uploadLarge.single('file'),
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
        
        // For non-profile files, check permissions: admin or assigned user
        if (file_type !== 'profile_picture') {
          const isAdmin = req.userRoles?.includes('admin') || req.userRole === 'admin';
          
          if (!isAdmin && req.userId) {
            // Check if user is assigned to this short
            const assignmentResult = await db.query(
              `SELECT * FROM assignments 
               WHERE short_id = $1 AND user_id = $2 AND role IN ('clipper', 'editor', 'script_writer')`,
              [short_id, req.userId]
            );
            
            // Also check if user is the script writer
            const shortResult = await db.query(
              'SELECT script_writer_id FROM shorts WHERE id = $1',
              [short_id]
            );
            
            const isScriptWriter = shortResult.rows.length > 0 && 
                                   shortResult.rows[0].script_writer_id === req.userId;
            
            if (assignmentResult.rows.length === 0 && !isScriptWriter) {
              res.status(403).json({ error: 'You do not have permission to upload files for this short' });
              return;
            }
          }
        }
        
        // For profile pictures, return the URL directly (don't store in files table)
        if (file_type === 'profile_picture') {
          const bucketPath = await uploadFile(req.file, undefined, file_type, req.userId, parseInt(user_id));
          const { getSignedUrl } = await import('../services/gcpStorage');
          const url = await getSignedUrl(bucketPath, 31536000); // 1 year expiry for profile pictures
          res.status(201).json({ gcp_bucket_path: bucketPath, url });
          return;
        }
        
        // For regular files, delete existing files of the same type first (replace operation)
        const existingFiles = await db.query(
          'SELECT id, gcp_bucket_path FROM files WHERE short_id = $1 AND file_type = $2',
          [short_id, file_type]
        );
        
        // Delete existing files from GCP and database
        for (const existingFile of existingFiles.rows) {
          try {
            await deleteFile(existingFile.gcp_bucket_path);
          } catch (error) {
            logger.error('Failed to delete existing file from GCP', { bucketPath: existingFile.gcp_bucket_path, error });
          }
          await db.query('DELETE FROM files WHERE id = $1', [existingFile.id]);
        }
        
        // Upload new file to GCS (this can take time for large files)
        const bucketPath = await uploadFile(req.file, parseInt(short_id), file_type, req.userId);
        
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
        const errorMessage = error instanceof Error ? error.message : 'Failed to upload file';
        console.error('Upload error details:', {
          message: errorMessage,
          gcpProjectId: process.env.GCP_PROJECT_ID ? 'SET' : 'MISSING',
          gcpBucketName: process.env.GCP_BUCKET_NAME ? 'SET' : 'MISSING',
          gcpKeyFile: process.env.GCP_KEY_FILE ? 'SET' : 'MISSING (using Application Default Credentials)',
        });
        res.status(500).json({ 
          error: 'Failed to upload file',
          details: errorMessage 
        });
      }
    }
  ],

  async getByShortId(req: AuthRequest, res: Response): Promise<void> {
    const { shortId } = req.params;
    try {
      const db = getPool();
      
      // Check permissions: admin or assigned user
      const isAdmin = req.userRoles?.includes('admin') || req.userRole === 'admin';
      
      if (!isAdmin && req.userId) {
        // Check if user is assigned to this short
        const assignmentResult = await db.query(
          `SELECT * FROM assignments 
           WHERE short_id = $1 AND user_id = $2 AND role IN ('clipper', 'editor', 'script_writer')`,
          [shortId, req.userId]
        );
        
        // Also check if user is the script writer
        const shortResult = await db.query(
          'SELECT script_writer_id FROM shorts WHERE id = $1',
          [shortId]
        );
        
        const isScriptWriter = shortResult.rows.length > 0 && 
                               shortResult.rows[0].script_writer_id === req.userId;
        
        if (assignmentResult.rows.length === 0 && !isScriptWriter) {
          res.status(403).json({ error: 'You do not have permission to view files for this short' });
          return;
        }
      }
      
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
        result.rows.map(async (file: any) => {
          try {
            if (!file.gcp_bucket_path) {
              logger.warn('File missing gcp_bucket_path', { fileId: file.id, fileName: file.file_name });
              return { ...file, download_url: null };
            }
            const url = await getSignedUrl(file.gcp_bucket_path);
            return { ...file, download_url: url };
          } catch (error) {
            logger.error('Failed to get signed URL for file', { 
              fileId: file.id, 
              fileName: file.file_name,
              bucketPath: file.gcp_bucket_path,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined
            });
            return { ...file, download_url: null };
          }
        })
      );
      
      res.json(filesWithUrls);
    } catch (error) {
      logger.error('Get files error', { shortId, error });
      res.status(500).json({ error: 'Failed to fetch files' });
    }
  },

  async download(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const db = getPool();
      
      const result = await db.query('SELECT * FROM files WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      
      const file = result.rows[0];
      
      // Check permissions: admin or assigned user
      const isAdmin = req.userRoles?.includes('admin') || req.userRole === 'admin';
      
      if (!isAdmin && req.userId) {
        // Check if user is assigned to this short
        const assignmentResult = await db.query(
          `SELECT * FROM assignments 
           WHERE short_id = $1 AND user_id = $2 AND role IN ('clipper', 'editor', 'script_writer')`,
          [file.short_id, req.userId]
        );
        
        // Also check if user is the script writer
        const shortResult = await db.query(
          'SELECT script_writer_id FROM shorts WHERE id = $1',
          [file.short_id]
        );
        
        const isScriptWriter = shortResult.rows.length > 0 && 
                               shortResult.rows[0].script_writer_id === req.userId;
        
        if (assignmentResult.rows.length === 0 && !isScriptWriter) {
          res.status(403).json({ error: 'You do not have permission to download this file' });
          return;
        }
      }
      const url = await getSignedUrl(file.gcp_bucket_path, 3600); // 1 hour expiry
      
      res.json({ download_url: url });
    } catch (error) {
      logger.error('Download file error', { fileId: id, error });
      res.status(500).json({ error: 'Failed to generate download URL' });
    }
  },

  async delete(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const db = getPool();
      
      const result = await db.query('SELECT * FROM files WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      
      const file = result.rows[0];
      
      // Check permissions: admin or assigned user
      const isAdmin = req.userRoles?.includes('admin') || req.userRole === 'admin';
      
      if (!isAdmin && req.userId) {
        // Check if user is assigned to this short
        const assignmentResult = await db.query(
          `SELECT * FROM assignments 
           WHERE short_id = $1 AND user_id = $2 AND role IN ('clipper', 'editor', 'script_writer')`,
          [file.short_id, req.userId]
        );
        
        // Also check if user is the script writer
        const shortResult = await db.query(
          'SELECT script_writer_id FROM shorts WHERE id = $1',
          [file.short_id]
        );
        
        const isScriptWriter = shortResult.rows.length > 0 && 
                               shortResult.rows[0].script_writer_id === req.userId;
        
        if (assignmentResult.rows.length === 0 && !isScriptWriter) {
          res.status(403).json({ error: 'You do not have permission to delete this file' });
          return;
        }
      }
      
      // Delete from GCP
      await deleteFile(file.gcp_bucket_path);
      
      // Delete from database
      await db.query('DELETE FROM files WHERE id = $1', [id]);
      
      res.json({ message: 'File deleted successfully' });
    } catch (error) {
      logger.error('Delete file error', { fileId: id, error });
      res.status(500).json({ error: 'Failed to delete file' });
    }
  },

  // Generate signed URL for direct upload to GCS
  async getUploadUrl(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { short_id, file_type, file_name, file_size, content_type, user_id } = req.body;
      
      if (!file_type || !file_name || !file_size || !content_type) {
        res.status(400).json({ error: 'file_type, file_name, file_size, and content_type are required' });
        return;
      }

      const db = getPool();
      
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
        
        // Check permissions: admin or assigned user
        const isAdmin = req.userRoles?.includes('admin') || req.userRole === 'admin';
        
        if (!isAdmin && req.userId) {
          const assignmentResult = await db.query(
            `SELECT * FROM assignments 
             WHERE short_id = $1 AND user_id = $2 AND role IN ('clipper', 'editor', 'script_writer')`,
            [short_id, req.userId]
          );
          
          const shortResult = await db.query(
            'SELECT script_writer_id FROM shorts WHERE id = $1',
            [short_id]
          );
          
          const isScriptWriter = shortResult.rows.length > 0 && 
                                 shortResult.rows[0].script_writer_id === req.userId;
          
          if (assignmentResult.rows.length === 0 && !isScriptWriter) {
            res.status(403).json({ error: 'You do not have permission to upload files for this short' });
            return;
          }
        }
      }

      // Generate bucket path
      const bucketPath = generateBucketPath(
        file_type === 'profile_picture' ? undefined : parseInt(short_id),
        file_type,
        file_name,
        file_type === 'profile_picture' ? parseInt(user_id) : undefined
      );

      // Generate signed upload URL (valid for 1 hour)
      const uploadUrl = await getSignedUploadUrl(bucketPath, content_type, 3600);

      res.json({
        upload_url: uploadUrl,
        bucket_path: bucketPath,
        expires_in: 3600
      });
    } catch (error) {
      logger.error('Get upload URL error', { error });
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  },

  // Confirm upload completion and save metadata
  async confirmUpload(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { short_id, file_type, bucket_path, file_name, file_size, mime_type, user_id } = req.body;
      
      if (!file_type || !bucket_path || !file_name || !file_size) {
        res.status(400).json({ error: 'file_type, bucket_path, file_name, and file_size are required' });
        return;
      }

      const db = getPool();
      
      // For profile pictures, return the URL directly (don't store in files table)
      if (file_type === 'profile_picture') {
        if (!user_id || parseInt(user_id) !== req.userId) {
          res.status(403).json({ error: 'You can only upload your own profile picture' });
          return;
        }
        const { getSignedUrl } = await import('../services/gcpStorage');
        const url = await getSignedUrl(bucket_path, 31536000); // 1 year expiry
        res.status(201).json({ gcp_bucket_path: bucket_path, url });
        return;
      }

      if (!short_id) {
        res.status(400).json({ error: 'short_id required for non-profile files' });
        return;
      }

      // Check permissions
      const isAdmin = req.userRoles?.includes('admin') || req.userRole === 'admin';
      
      if (!isAdmin && req.userId) {
        const assignmentResult = await db.query(
          `SELECT * FROM assignments 
           WHERE short_id = $1 AND user_id = $2 AND role IN ('clipper', 'editor', 'script_writer')`,
          [short_id, req.userId]
        );
        
        const shortResult = await db.query(
          'SELECT script_writer_id FROM shorts WHERE id = $1',
          [short_id]
        );
        
        const isScriptWriter = shortResult.rows.length > 0 && 
                               shortResult.rows[0].script_writer_id === req.userId;
        
        if (assignmentResult.rows.length === 0 && !isScriptWriter) {
          res.status(403).json({ error: 'You do not have permission to upload files for this short' });
          return;
        }
      }

      // Delete existing files of the same type first (replace operation)
      const existingFiles = await db.query(
        'SELECT id, gcp_bucket_path FROM files WHERE short_id = $1 AND file_type = $2',
        [short_id, file_type]
      );
      
      for (const existingFile of existingFiles.rows) {
        try {
          await deleteFile(existingFile.gcp_bucket_path);
        } catch (error) {
          logger.error('Failed to delete existing file from GCS', { bucketPath: existingFile.gcp_bucket_path, error });
        }
        await db.query('DELETE FROM files WHERE id = $1', [existingFile.id]);
      }

      // Insert file record
      const result = await db.query(
        `INSERT INTO files (short_id, file_type, gcp_bucket_path, file_name, file_size, mime_type, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          short_id,
          file_type,
          bucket_path,
          file_name,
          parseInt(file_size),
          mime_type || 'application/octet-stream',
          req.userId
        ]
      );
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      logger.error('Confirm upload error', { error });
      res.status(500).json({ error: 'Failed to confirm upload' });
    }
  }
};

