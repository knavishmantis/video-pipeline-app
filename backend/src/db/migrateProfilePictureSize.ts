import { query } from './index';

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL;
  return dbUrl?.startsWith('sqlite://') || false;
}

export async function migrateProfilePictureSize(): Promise<void> {
  try {
    if (isSqlite()) {
      // SQLite doesn't support ALTER COLUMN, so we'd need to recreate the table
      // For now, just log a warning - SQLite TEXT can handle long strings
      console.log('SQLite: profile_picture column uses TEXT type which supports long strings');
      return;
    } else {
      // PostgreSQL: Alter column to TEXT (unlimited) or VARCHAR(2000)
      // Using TEXT for flexibility with GCP signed URLs
      await query(`
        ALTER TABLE users 
        ALTER COLUMN profile_picture TYPE TEXT;
      `);
      console.log('Updated profile_picture column to TEXT to support long GCP signed URLs');
    }
  } catch (error: any) {
    // Ignore if column type is already correct or column doesn't exist
    if (error.message?.includes('does not exist') || error.message?.includes('already')) {
      console.log('Profile picture column migration skipped:', error.message);
      return;
    }
    console.error('Profile picture size migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateProfilePictureSize()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

