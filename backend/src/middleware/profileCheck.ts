import { Response, NextFunction } from 'express';
import { query } from '../db';
import { AuthRequest } from './auth';
import { logger } from '../utils/logger';

export async function requireProfileComplete(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  // Sample clippers cannot access routes that require a complete profile.
  // They are confined to the sample routes + formula guide. Return a distinct
  // error so the frontend can redirect them to /clipper-sample.
  if (req.userRoles?.includes('sample_clipper') || req.userRole === 'sample_clipper') {
    res.status(403).json({ error: 'Sample access only', sample_clipper: true });
    return;
  }

  try {
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

    if (!isComplete) {
      res.status(403).json({
        error: 'Profile incomplete',
        missing: {
          discord_username: !user.discord_username,
          paypal_email: !user.paypal_email,
        }
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Profile check error', { error });
    res.status(500).json({ error: 'Failed to verify profile' });
  }
}

