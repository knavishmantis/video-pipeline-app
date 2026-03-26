import { query } from './index';
import dotenv from 'dotenv';

dotenv.config();

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL;
  return dbUrl?.startsWith('sqlite://') || false;
}

export async function migrateIncentiveRules(): Promise<void> {
  try {
    if (isSqlite()) {
      await query(`
        CREATE TABLE IF NOT EXISTS incentive_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role VARCHAR(50) NOT NULL CHECK (role IN ('clipper', 'editor')),
          metric VARCHAR(50) NOT NULL CHECK (metric IN ('views', 'subscribers_gained')),
          threshold BIGINT NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, role, metric, threshold)
        )
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS incentive_rules (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role VARCHAR(50) NOT NULL CHECK (role IN ('clipper', 'editor')),
          metric VARCHAR(50) NOT NULL CHECK (metric IN ('views', 'subscribers_gained')),
          threshold BIGINT NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, role, metric, threshold)
        )
      `);
    }

    await query('CREATE INDEX IF NOT EXISTS idx_incentive_rules_user_id ON incentive_rules(user_id)');

    // Add milestone_key to payments for dedup
    if (isSqlite()) {
      // SQLite: check if column exists first
      try {
        await query(`SELECT milestone_key FROM payments LIMIT 0`);
      } catch {
        await query(`ALTER TABLE payments ADD COLUMN milestone_key VARCHAR(255) UNIQUE`);
      }
    } else {
      await query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS milestone_key VARCHAR(255) UNIQUE`);
    }

    console.log('Incentive rules migration completed successfully');
  } catch (error) {
    console.error('Incentive rules migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  migrateIncentiveRules()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
