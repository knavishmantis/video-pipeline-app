import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../../../shared/types';
import { getPool } from '../db';

export interface AuthRequest extends Request {
  userId?: number;
  userRoles?: UserRole[];
  userRole?: UserRole; // Primary role for backward compatibility
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { 
      userId: number; 
      roles?: UserRole[]; 
      role?: UserRole;
    };
    req.userId = decoded.userId;
    req.userRoles = decoded.roles || (decoded.role ? [decoded.role] : []);
    req.userRole = decoded.role || decoded.roles?.[0]; // Primary role for backward compatibility
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    // If roles not in JWT, fetch from database
    if (!req.userRoles || req.userRoles.length === 0) {
      try {
        const db = getPool();
        const result = await db.query('SELECT role FROM user_roles WHERE user_id = $1', [req.userId]);
        req.userRoles = result.rows.map((r: any) => r.role as UserRole);
      } catch (error) {
        // If user_roles table doesn't exist, check legacy role
        if (req.userRole) {
          req.userRoles = [req.userRole];
        } else {
          res.status(403).json({ error: 'Insufficient permissions' });
          return;
        }
      }
    }
    
    // Check if user has at least one of the required roles
    const hasRole = req.userRoles.some(role => roles.includes(role));
    if (!hasRole) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    
    next();
  };
}

