import { query } from './index';

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL || '';
  return dbUrl.startsWith('sqlite://');
}

export async function migrateAnalyzedShorts(): Promise<void> {
  try {
    if (isSqlite()) {
      // SQLite: Create table
      await query(`
        CREATE TABLE IF NOT EXISTS analyzed_shorts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          youtube_video_id VARCHAR(20) UNIQUE NOT NULL,
          channel_name VARCHAR(255) NOT NULL,
          channel_id VARCHAR(50) NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          transcript TEXT,
          transcript_source VARCHAR(50),
          views INTEGER DEFAULT 0,
          likes INTEGER DEFAULT 0,
          comments INTEGER DEFAULT 0,
          published_at TIMESTAMP,
          estimated_score DECIMAL(5,2),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('SQLite: analyzed_shorts table created');
    } else {
      // PostgreSQL: Create table
      await query(`
        CREATE TABLE IF NOT EXISTS analyzed_shorts (
          id SERIAL PRIMARY KEY,
          youtube_video_id VARCHAR(20) UNIQUE NOT NULL,
          channel_name VARCHAR(255) NOT NULL,
          channel_id VARCHAR(50) NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          transcript TEXT,
          transcript_source VARCHAR(50),
          views INTEGER DEFAULT 0,
          likes INTEGER DEFAULT 0,
          comments INTEGER DEFAULT 0,
          published_at TIMESTAMP,
          estimated_score DECIMAL(5,2),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('PostgreSQL: analyzed_shorts table created');
    }

    // Create indexes
    try {
      await query('CREATE INDEX IF NOT EXISTS idx_analyzed_shorts_channel_id ON analyzed_shorts(channel_id)');
      await query('CREATE INDEX IF NOT EXISTS idx_analyzed_shorts_published_at ON analyzed_shorts(published_at)');
      await query('CREATE INDEX IF NOT EXISTS idx_analyzed_shorts_views ON analyzed_shorts(views)');
      console.log('Indexes created');
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        console.warn('Could not create indexes:', error.message);
      }
    }

    console.log('Analyzed shorts migration completed successfully');
  } catch (error) {
    console.error('Analyzed shorts migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateAnalyzedShorts()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

