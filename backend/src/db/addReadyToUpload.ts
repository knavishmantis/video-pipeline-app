import { query } from './index';
import dotenv from 'dotenv';

dotenv.config();

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL;
  return dbUrl?.startsWith('sqlite://') || false;
}

export async function addReadyToUploadStatus(): Promise<void> {
  try {
    if (isSqlite()) {
      // SQLite doesn't support altering CHECK constraints easily
      // The constraint will be enforced at application level
      console.log('SQLite detected: Status constraint will be enforced at application level');
      console.log('ready_to_upload status is now available');
      return;
    }

    // PostgreSQL: Drop and recreate constraint with 'ready_to_upload'
    try {
      await query('ALTER TABLE shorts DROP CONSTRAINT IF EXISTS shorts_status_check');
    } catch (error: any) {
      console.log('Note: Could not drop existing constraint (may not exist)');
    }

    // Recreate constraint with 'ready_to_upload'
    await query(`
      ALTER TABLE shorts 
      ADD CONSTRAINT shorts_status_check 
      CHECK (status IN ('idea', 'script', 'clipping', 'clips', 'clip_changes', 'editing', 'editing_changes', 'completed', 'ready_to_upload', 'uploaded'))
    `);

    console.log('ready_to_upload status migration completed successfully');
  } catch (error) {
    console.error('Add ready_to_upload status migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addReadyToUploadStatus()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

