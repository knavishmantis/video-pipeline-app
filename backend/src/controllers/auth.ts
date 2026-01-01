import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { query, getPool } from '../db';
import { AuthRequest } from '../middleware/auth';
import { User, AuthResponse, UserRole } from '../../../shared/types';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

// Helper to get user roles
async function getUserRoles(userId: number): Promise<UserRole[]> {
  try {
    const result = await query('SELECT role FROM user_roles WHERE user_id = $1', [userId]);
    return result.rows.map((r: any) => r.role as UserRole);
  } catch (error) {
    // If user_roles table doesn't exist yet, return empty array
    return [];
  }
}

const googleClient = config.google.clientId 
  ? new OAuth2Client(config.google.clientId)
  : null;

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, name, password, role } = req.body;
      
      if (!email || !name || !password || !role) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const db = getPool();
      const passwordHash = await bcrypt.hash(password, 10);
      
      const result = await db.query(
        'INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, created_at, updated_at',
        [email, name, passwordHash, role]
      );

      const user: User = result.rows[0];
      const token = jwt.sign(
        { userId: user.id, role: user.role },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
      );

      const response: AuthResponse = { user, token };
      res.status(201).json(response);
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        res.status(409).json({ error: 'Email already exists' });
      } else {
        logger.error('Registration error', { error });
        res.status(500).json({ error: 'Registration failed' });
      }
    }
  },

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, googleToken } = req.body;
      
      let user: any;

      // Google OAuth login
      if (googleToken) {
        if (!googleClient || !config.google.clientId) {
          res.status(500).json({ error: 'Google OAuth not configured on server' });
          return;
        }
        try {
          logger.info('Verifying Google token', { clientId: config.google.clientId?.substring(0, 20) + '...' });
          const ticket = await googleClient.verifyIdToken({
            idToken: googleToken,
            audience: config.google.clientId,
          });
          logger.info('Google token verified successfully');
          const payload = ticket.getPayload();
          
          if (!payload || !payload.email) {
            res.status(401).json({ error: 'Invalid Google token' });
            return;
          }

          // Find or create user
          let result = await query(
            'SELECT id, email, name, discord_username, paypal_email, profile_picture, timezone, created_at, updated_at FROM users WHERE email = $1',
            [payload.email]
          );

          if (result.rows.length === 0) {
            // User doesn't exist - only allow if email matches admin
            if (payload.email !== 'quinncaverly@gmail.com') {
              res.status(403).json({ error: 'User not found. Only admin can sign in with Google OAuth initially.' });
              return;
            }
            // Create admin user
            result = await query(
              `INSERT INTO users (email, name) 
               VALUES ($1, $2) 
               RETURNING id, email, name, discord_username, paypal_email, profile_picture, timezone, created_at, updated_at`,
              [payload.email, payload.name || 'Admin']
            );
            // Set admin role
            await query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [result.rows[0].id, 'admin']);
          }

          user = result.rows[0];
          // Get roles
          const roles = await getUserRoles(user.id);
          user.roles = roles;
          
          // Process profile picture (convert bucket path to signed URL if needed)
          if (user.profile_picture && !user.profile_picture.startsWith('http') && user.profile_picture.includes('/')) {
            try {
              const { getSignedUrl } = await import('../services/gcpStorage');
              user.profile_picture = await getSignedUrl(user.profile_picture, 3600);
            } catch (error) {
              console.error('Failed to generate signed URL for profile picture:', error);
            }
          }
        } catch (error: unknown) {
          logger.error('Google OAuth error', { error });
          const errorMsg = error instanceof Error ? error.message : 'Invalid Google token';
          res.status(401).json({ error: `Google authentication failed: ${errorMsg}` });
          return;
        }
      } 
      // Password login (fallback)
      else if (email && password) {
        const result = await query(
          'SELECT id, email, name, password_hash, discord_username, paypal_email, profile_picture, timezone, created_at, updated_at FROM users WHERE email = $1',
          [email]
        );

        if (result.rows.length === 0) {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }

        user = result.rows[0];
        
        if (!user.password_hash) {
          res.status(401).json({ error: 'Password not set. Please use Google sign-in.' });
          return;
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
          res.status(401).json({ error: 'Invalid credentials' });
          return;
        }
        
        // Get roles
        const roles = await getUserRoles(user.id);
        user.roles = roles;
        
        // Process profile picture (convert bucket path to signed URL if needed)
        if (user.profile_picture && !user.profile_picture.startsWith('http') && user.profile_picture.includes('/')) {
          try {
            const { getSignedUrl } = await import('../services/gcpStorage');
            user.profile_picture = await getSignedUrl(user.profile_picture, 3600);
          } catch (error) {
            console.error('Failed to generate signed URL for profile picture:', error);
          }
        }
      } else {
        res.status(400).json({ error: 'Email/password or Google token required' });
        return;
      }

      delete user.password_hash;
      // JWT stores primary role (first role, or admin if present) for backward compatibility
      const primaryRole = user.roles?.includes('admin') ? 'admin' : (user.roles?.[0] || 'script_writer');
      const token = jwt.sign(
        { userId: user.id, roles: user.roles, role: primaryRole },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
      );

      const response: AuthResponse = { user, token };
      res.json(response);
    } catch (error) {
      logger.error('Login error', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      res.status(500).json({ error: errorMessage });
    }
  },

  async getMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const result = await query(
        'SELECT id, email, name, discord_username, paypal_email, profile_picture, timezone, created_at, updated_at FROM users WHERE id = $1',
        [req.userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const user = result.rows[0];
      const roles = await getUserRoles(user.id);
      
      // Process profile picture (convert bucket path to signed URL if needed)
      let profilePicture = user.profile_picture;
      if (profilePicture && !profilePicture.startsWith('http') && profilePicture.includes('/')) {
        try {
          const { getSignedUrl } = await import('../services/gcpStorage');
          profilePicture = await getSignedUrl(profilePicture, 3600); // 1 hour expiry
        } catch (error) {
          logger.error('Failed to generate signed URL for profile picture', { error, bucketPath: profilePicture });
          // Keep the bucket path if signed URL generation fails
        }
      }
      
      res.json({ ...user, roles, profile_picture: profilePicture });
    } catch (error) {
      logger.error('Get me error', { error });
      res.status(500).json({ error: 'Failed to get user' });
    }
  },

  async checkProfileComplete(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const result = await query(
        'SELECT discord_username, paypal_email FROM users WHERE id = $1',
        [req.userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const user = result.rows[0];
      // Profile is complete if discord_username and paypal_email are set
      const isComplete = !!(user.discord_username && user.paypal_email);
      
      res.json({ 
        complete: isComplete,
        missing: {
          discord_username: !user.discord_username,
          paypal_email: !user.paypal_email
        }
      });
    } catch (error) {
      logger.error('Check profile complete error', { error });
      res.status(500).json({ error: 'Failed to check profile' });
    }
  }
};

