import { query } from './index';
import dotenv from 'dotenv';

dotenv.config();

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL;
  return dbUrl?.startsWith('sqlite://') || false;
}

export async function removeScriptRatingColumn(): Promise<void> {
  try {
    if (isSqlite()) {
      console.log('SQLite detected: script_rating column removal skipped (SQLite does not support DROP COLUMN easily)');
      return;
    }

    await query('ALTER TABLE shorts DROP COLUMN IF EXISTS script_rating');
    console.log('Dropped column: script_rating');
    console.log('Script rating column removal completed successfully');
  } catch (error) {
    console.error('Remove script rating column migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  removeScriptRatingColumn()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
