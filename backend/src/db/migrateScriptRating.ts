import { query } from './index';
import dotenv from 'dotenv';

dotenv.config();

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL;
  return dbUrl?.startsWith('sqlite://') || false;
}

export async function migrateScriptRating(): Promise<void> {
  try {
    if (isSqlite()) {
      console.log('SQLite detected: Adding script_rating column');
      // SQLite syntax
      await query(`
        ALTER TABLE shorts 
        ADD COLUMN script_rating DECIMAL(3,1) CHECK (script_rating >= 0 AND script_rating <= 10)
      `);
      console.log('script_rating column added successfully');
      return;
    }

    // PostgreSQL syntax
    await query(`
      ALTER TABLE shorts 
      ADD COLUMN IF NOT EXISTS script_rating DECIMAL(3,1) CHECK (script_rating >= 0 AND script_rating <= 10)
    `);

    console.log('script_rating column migration completed successfully');
  } catch (error: any) {
    // Column might already exist
    if (error.code === '42701' || error.message?.includes('duplicate column')) {
      console.log('script_rating column already exists, skipping migration');
      return;
    }
    console.error('Add script_rating column migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  migrateScriptRating()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}


