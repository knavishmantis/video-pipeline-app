import { query } from './index';

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL || '';
  return dbUrl.startsWith('sqlite://');
}

// Migration to add 'ready_to_upload' status
const MIGRATE_STATUS = `
-- For PostgreSQL, we need to drop and recreate the constraint
-- For SQLite, we can't easily modify CHECK constraints, so we'll just note it
-- The constraint will be enforced at the application level for SQLite
`;

export async function migrateStatus(): Promise<void> {
  try {
    if (isSqlite()) {
      // SQLite doesn't support altering CHECK constraints easily
      // The constraint will be enforced at application level
      console.log('SQLite detected: Status constraint will be enforced at application level');
      console.log('ready_to_upload status is now available');
      return;
    }

    // PostgreSQL: Drop and recreate constraint
    try {
      await query('ALTER TABLE shorts DROP CONSTRAINT IF EXISTS shorts_status_check');
    } catch (error: any) {
      // Constraint might not exist or have a different name
      console.log('Note: Could not drop existing constraint (may not exist)');
    }

    await query(`
      ALTER TABLE shorts 
      ADD CONSTRAINT shorts_status_check 
      CHECK (status IN ('idea', 'script', 'clipping', 'editing', 'completed', 'ready_to_upload'))
    `);

    console.log('Status migration completed successfully');
    console.log('ready_to_upload status is now available');
  } catch (error) {
    console.error('Status migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateStatus()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

