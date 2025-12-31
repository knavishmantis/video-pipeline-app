import bcrypt from 'bcryptjs';
import { getPool } from '../db';
import dotenv from 'dotenv';

dotenv.config();

async function createAdmin() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || 'Admin User';

  if (!email || !password) {
    console.error('Usage: tsx src/scripts/createAdmin.ts <email> <password> [name]');
    process.exit(1);
  }

  try {
    const db = getPool();
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id, email, name, role`,
      [email, name, passwordHash]
    );

    console.log('Admin user created successfully:');
    console.log(JSON.stringify(result.rows[0], null, 2));
    process.exit(0);
  } catch (error: any) {
    if (error.code === '23505') {
      console.error('Error: Email already exists');
    } else {
      console.error('Error creating admin user:', error);
    }
    process.exit(1);
  }
}

createAdmin();

