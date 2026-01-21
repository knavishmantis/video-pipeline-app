import { query } from './index';

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL || '';
  return dbUrl.startsWith('sqlite://');
}

export async function migrateAnalyzedShortsFix(): Promise<void> {
  try {
    if (isSqlite()) {
      // SQLite doesn't support ALTER COLUMN, so we'd need to recreate the table
      // For now, just log a warning
      console.log('SQLite: Cannot alter column type. If needed, recreate table with VARCHAR(50) for transcript_source');
    } else {
      // PostgreSQL: Alter column type
      try {
        await query('ALTER TABLE analyzed_shorts ALTER COLUMN transcript_source TYPE VARCHAR(50)');
        console.log('Updated transcript_source column to VARCHAR(50)');
      } catch (error: any) {
        if (error.message.includes('does not exist')) {
          console.log('Column does not exist, will be created with correct type on next migration');
        } else {
          console.warn('Could not alter transcript_source column:', error.message);
        }
      }
    }

    console.log('Analyzed shorts fix migration completed');
  } catch (error) {
    console.error('Analyzed shorts fix migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateAnalyzedShortsFix()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}


