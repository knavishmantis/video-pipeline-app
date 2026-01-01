import { Response } from 'express';
import { query } from '../db';
import { AuthRequest } from '../middleware/auth';
import { UserRole } from '../../../shared/types';
import { processProfilePicture } from '../utils/profilePicture';

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

// Helper to set user roles
async function setUserRoles(userId: number, roles: UserRole[]): Promise<void> {
  // Delete existing roles
  await query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
  // Insert new roles
  for (const role of roles) {
    await query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [userId, role]);
  }
}

// Helper to convert bucket path to signed URL if needed
// processProfilePicture is now imported from utils/profilePicture

export const usersController = {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const isAdmin = req.userRoles?.includes('admin') || req.userRole === 'admin';
      if (!isAdmin) {
        res.status(403).json({ error: 'Only admins can view all users' });
        return;
      }

      const { role } = req.query;
      
      let sqlQuery = 'SELECT id, email, name, discord_username, paypal_email, profile_picture, timezone, created_at, updated_at FROM users';
      const params: any[] = [];
      
      if (role) {
        sqlQuery += ` WHERE id IN (SELECT user_id FROM user_roles WHERE role = $1)`;
        params.push(role);
      }
      
      sqlQuery += ' ORDER BY name';
      
      const result = await query(sqlQuery, params);
      
      // Get roles and process profile pictures for each user
      const usersWithRoles = await Promise.all(
        result.rows.map(async (user: any) => {
          const roles = await getUserRoles(user.id);
          const profilePicture = await processProfilePicture(user.profile_picture);
          return { ...user, roles, profile_picture: profilePicture };
        })
      );
      
      res.json(usersWithRoles);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  },

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const isAdmin = req.userRoles?.includes('admin') || req.userRole === 'admin';
      if (!isAdmin) {
        res.status(403).json({ error: 'Only admins can view user details' });
        return;
      }

      const { id } = req.params;
      
      const result = await query(
        'SELECT id, email, name, discord_username, paypal_email, profile_picture, timezone, created_at, updated_at FROM users WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      
      const user = result.rows[0];
      const roles = await getUserRoles(user.id);
      const profilePicture = await processProfilePicture(user.profile_picture);
      res.json({ ...user, roles, profile_picture: profilePicture });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  },

  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const result = await query(
        'SELECT id, email, name, discord_username, paypal_email, profile_picture, timezone, created_at, updated_at FROM users WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      
      const user = result.rows[0];
      const roles = await getUserRoles(user.id);
      res.json({ ...user, roles });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  },

  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { email, discord_username, roles, paypal_email, profile_picture } = req.body;
      
      if (!email) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }
      
      if (!roles || !Array.isArray(roles) || roles.length === 0) {
        res.status(400).json({ error: 'At least one role is required' });
        return;
      }
      
      // Use Discord username as the name if provided, otherwise use email prefix
      const name = discord_username || email.split('@')[0];
      
      // Create user (no role column anymore)
      const result = await query(
        `INSERT INTO users (email, name, discord_username, paypal_email, profile_picture, timezone)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, name, discord_username, paypal_email, profile_picture, timezone, created_at, updated_at`,
        [email, name, discord_username, paypal_email || null, profile_picture || null, null]
      );
      
      const newUser = result.rows[0];
      
      // Set roles
      await setUserRoles(newUser.id, roles);
      
      // Return user with roles
      const userRoles = await getUserRoles(newUser.id);
      res.status(201).json({ ...newUser, roles: userRoles });
    } catch (error: any) {
      if (error.code === '23505') {
        res.status(409).json({ error: 'Email already exists' });
      } else {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
      }
    }
  },

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, email, discord_username, paypal_email, profile_picture, timezone, roles } = req.body;
      
      // Users can only update their own profile (unless admin)
      const isAdmin = req.userRoles?.includes('admin') || req.userRole === 'admin';
      if (parseInt(id) !== req.userId && !isAdmin) {
        res.status(403).json({ error: 'You can only update your own profile' });
        return;
      }
      
      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;
      
      // Only admins can update email
      if (email !== undefined && isAdmin) {
        // Check if email already exists (excluding current user)
        const existingUser = await query(
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [email, id]
        );
        if (existingUser.rows.length > 0) {
          res.status(409).json({ error: 'Email already exists' });
          return;
        }
        updates.push(`email = $${paramCount++}`);
        params.push(email);
      }
      
      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        params.push(name);
      }
      if (discord_username !== undefined) {
        updates.push(`discord_username = $${paramCount++}`);
        params.push(discord_username || null);
      }
      if (paypal_email !== undefined) {
        updates.push(`paypal_email = $${paramCount++}`);
        params.push(paypal_email || null);
      }
      if (profile_picture !== undefined) {
        updates.push(`profile_picture = $${paramCount++}`);
        params.push(profile_picture || null);
      }
      if (timezone !== undefined) {
        updates.push(`timezone = $${paramCount++}`);
        params.push(timezone || null);
      }
      
      // Update roles (admin only)
      if (roles !== undefined && Array.isArray(roles) && isAdmin) {
        await setUserRoles(parseInt(id), roles);
      }
      
      if (updates.length === 0 && !roles) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }
      
      if (updates.length > 0) {
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(id);
        
        await query(
          `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}`,
          params
        );
      }
      
      // Get updated user with roles
      const result = await query(
        'SELECT id, email, name, discord_username, paypal_email, profile_picture, timezone, created_at, updated_at FROM users WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      
      const user = result.rows[0];
      const userRoles = await getUserRoles(user.id);
      
      console.log('User profile updated:', { ...user, roles: userRoles });
      res.json({ ...user, roles: userRoles });
    } catch (error: any) {
      console.error('Update user error:', error);
      res.status(500).json({ error: error.message || 'Failed to update user' });
    }
  },

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const isAdmin = req.userRoles?.includes('admin') || req.userRole === 'admin';
      
      if (!isAdmin) {
        res.status(403).json({ error: 'Only admins can delete users' });
        return;
      }

      // Prevent deleting yourself
      if (parseInt(id) === req.userId) {
        res.status(400).json({ error: 'You cannot delete your own account' });
        return;
      }
      
      // Delete user roles first (foreign key constraint)
      await query('DELETE FROM user_roles WHERE user_id = $1', [id]);
      
      // Delete user
      const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
      
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
};

