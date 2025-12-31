import { query } from './index';

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL || '';
  return dbUrl.startsWith('sqlite://');
}

export async function migrateTimezone(): Promise<void> {
  try {
    // Check if column already exists
    const checkColumn = isSqlite()
      ? "SELECT COUNT(*) as count FROM pragma_table_info('users') WHERE name='timezone'"
      : "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_name='users' AND column_name='timezone'";
    
    const result = await query(checkColumn);
    const exists = isSqlite() 
      ? result[0]?.count > 0 
      : parseInt(result.rows[0]?.count || '0') > 0;

    if (exists) {
      console.log('timezone column already exists');
      return;
    }

    // Add timezone column
    const alterTable = isSqlite()
      ? 'ALTER TABLE users ADD COLUMN timezone VARCHAR(255)'
      : 'ALTER TABLE users ADD COLUMN timezone VARCHAR(255)';

    await query(alterTable);
    console.log('Added timezone column to users table');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateTimezone()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

