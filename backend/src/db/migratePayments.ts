import { query } from './index';
import dotenv from 'dotenv';

dotenv.config();

const MIGRATE_PAYMENTS_PG = `
-- Add new columns to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS role VARCHAR(50) CHECK (role IN ('clipper', 'editor'));
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rate_description TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL;

-- Add rate columns to assignments table
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS rate DECIMAL(10, 2);
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS rate_description TEXT;
`;

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL;
  return dbUrl?.startsWith('sqlite://') || false;
}

export async function migratePayments(): Promise<void> {
  try {
    if (isSqlite()) {
      // SQLite: Try to add columns, ignore if they exist
      const columns = [
        { name: 'role', type: 'VARCHAR(50)' },
        { name: 'rate_description', type: 'TEXT' },
        { name: 'completed_at', type: 'TIMESTAMP' },
        { name: 'assignment_id', type: 'INTEGER REFERENCES assignments(id)' },
      ];
      
      for (const col of columns) {
        try {
          await query(`ALTER TABLE payments ADD COLUMN ${col.name} ${col.type}`);
        } catch (error: any) {
          // Ignore "duplicate column" errors
          if (!error.message?.includes('duplicate column')) {
            throw error;
          }
        }
      }
      
      // Add columns to assignments
      const assignmentColumns = [
        { name: 'rate', type: 'DECIMAL(10, 2)' },
        { name: 'rate_description', type: 'TEXT' },
      ];
      
      for (const col of assignmentColumns) {
        try {
          await query(`ALTER TABLE assignments ADD COLUMN ${col.name} ${col.type}`);
        } catch (error: any) {
          if (!error.message?.includes('duplicate column')) {
            throw error;
          }
        }
      }
    } else {
      // PostgreSQL: Use IF NOT EXISTS
      const statements = MIGRATE_PAYMENTS_PG.split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      for (const statement of statements) {
        await query(statement);
      }
    }
    
    console.log('Payments migration completed successfully');
  } catch (error) {
    console.error('Payments migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migratePayments()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

