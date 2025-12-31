import { Response, NextFunction } from 'express';
import { query } from '../db';
import { AuthRequest } from './auth';

export async function requireProfileComplete(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Not authenticated' });
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
    console.error('Profile check error:', error);
    res.status(500).json({ error: 'Failed to verify profile' });
  }
}

