import bcrypt from 'bcryptjs';
import { query } from '../db';
import dotenv from 'dotenv';

dotenv.config();

async function setupAdmin() {
  const email = 'quinncaverly@gmail.com';
  const password = process.argv[2]; // Optional now
  const name = process.argv[3] || 'Quinn Caverly';

  try {
    // Check if user already exists
    const existing = await query('SELECT id, email FROM users WHERE email = $1', [email]);
    
    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      
      // Ensure admin role exists in user_roles
      const roleCheck = await query(
        'SELECT role FROM user_roles WHERE user_id = $1 AND role = $2',
        [user.id, 'admin']
      );
      
      if (roleCheck.rows.length === 0) {
        await query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [user.id, 'admin']);
        console.log(`Added admin role to existing user: ${email}`);
      } else {
        console.log(`User already has admin role: ${email}`);
      }
      
      // Update password if provided
      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, user.id]);
        console.log('Password updated');
      } else {
        console.log('No password provided - user will use Google OAuth only');
      }
      
      // Update name
      await query('UPDATE users SET name = $1 WHERE id = $2', [name, user.id]);
      
      const result = await query(
        'SELECT id, email, name FROM users WHERE id = $1',
        [user.id]
      );
      
      const rolesResult = await query('SELECT role FROM user_roles WHERE user_id = $1', [user.id]);
      const roles = rolesResult.rows.map((r: any) => r.role);
      
      console.log('\nAdmin user configured:');
      console.log(JSON.stringify({ ...result.rows[0], roles }, null, 2));
      console.log('\n✅ You can now sign in with Google OAuth at quinncaverly@gmail.com');
      process.exit(0);
    } else {
      // Create new admin user
      const passwordHash = password ? await bcrypt.hash(password, 10) : null;
      
      const result = await query(
        `INSERT INTO users (email, name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, email, name`,
        [email, name, passwordHash]
      );
      
      // Set admin role
      await query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [result.rows[0].id, 'admin']);

      console.log('Admin user created successfully:');
      console.log(JSON.stringify({ ...result.rows[0], roles: ['admin'] }, null, 2));
      console.log('\n✅ Your Google account (quinncaverly@gmail.com) is now set as admin');
      console.log('✅ Sign in with Google OAuth (no password needed)');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('Error setting up admin:', error);
    process.exit(1);
  }
}

setupAdmin();

