import { query } from './index';
import dotenv from 'dotenv';

dotenv.config();

const MIGRATE_USER_RATES_PG = `
-- Create user_rates table to store rates per user per role
CREATE TABLE IF NOT EXISTS user_rates (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('clipper', 'editor')),
  rate DECIMAL(10, 2) NOT NULL,
  rate_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_rates_user_id ON user_rates(user_id);
CREATE INDEX IF NOT EXISTS idx_user_rates_role ON user_rates(role);
`;

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL;
  return dbUrl?.startsWith('sqlite://') || false;
}

export async function migrateUserRates(): Promise<void> {
  try {
    if (isSqlite()) {
      // SQLite: Create table if it doesn't exist
      await query(`
        CREATE TABLE IF NOT EXISTS user_rates (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role VARCHAR(50) NOT NULL CHECK (role IN ('clipper', 'editor')),
          rate DECIMAL(10, 2) NOT NULL,
          rate_description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, role)
        )
      `);
      
      // Create indexes
      try {
        await query(`CREATE INDEX IF NOT EXISTS idx_user_rates_user_id ON user_rates(user_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_user_rates_role ON user_rates(role)`);
      } catch (error: any) {
        // Ignore index creation errors if they already exist
        if (!error.message?.includes('already exists')) {
          throw error;
        }
      }
    } else {
      // PostgreSQL: Use IF NOT EXISTS
      const statements = MIGRATE_USER_RATES_PG.split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      for (const statement of statements) {
        await query(statement);
      }
    }
    
    console.log('User rates migration completed successfully');
  } catch (error) {
    console.error('User rates migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateUserRates()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

