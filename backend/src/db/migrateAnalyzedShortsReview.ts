import { query } from './index';

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL || '';
  return dbUrl.startsWith('sqlite://');
}

export async function migrateAnalyzedShortsReview(): Promise<void> {
  try {
    if (isSqlite()) {
      // SQLite: Add columns
      const columns = [
        { name: 'percentile', type: 'DECIMAL(5,2)' },
        { name: 'user_guess_percentile', type: 'DECIMAL(5,2)' },
        { name: 'reviewed_at', type: 'TIMESTAMP' },
        { name: 'review_user_id', type: 'INTEGER' },
      ];

      for (const col of columns) {
        try {
          await query(`ALTER TABLE analyzed_shorts ADD COLUMN ${col.name} ${col.type}`);
          console.log(`Added ${col.name} column`);
        } catch (error: any) {
          if (!error.message.includes('duplicate column')) {
            console.warn(`Could not add ${col.name} column:`, error.message);
          }
        }
      }
    } else {
      // PostgreSQL: Add columns
      const columns = [
        { name: 'percentile', type: 'DECIMAL(5,2)' },
        { name: 'user_guess_percentile', type: 'DECIMAL(5,2)' },
        { name: 'reviewed_at', type: 'TIMESTAMP' },
        { name: 'review_user_id', type: 'INTEGER' },
      ];

      for (const col of columns) {
        try {
          // Check if column exists
          const checkResult = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'analyzed_shorts' AND column_name = $1
          `, [col.name]);

          if (checkResult.rows.length === 0) {
            await query(`ALTER TABLE analyzed_shorts ADD COLUMN ${col.name} ${col.type}`);
            console.log(`Added ${col.name} column`);
          } else {
            console.log(`Column ${col.name} already exists`);
          }
        } catch (error: any) {
          if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
            console.warn(`Could not add ${col.name} column:`, error.message);
          }
        }
      }

      // Add foreign key constraint for review_user_id if it doesn't exist
      try {
        await query(`
          ALTER TABLE analyzed_shorts 
          ADD CONSTRAINT fk_analyzed_shorts_review_user 
          FOREIGN KEY (review_user_id) REFERENCES users(id)
        `);
        console.log('Added foreign key constraint for review_user_id');
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.warn('Could not add foreign key constraint:', error.message);
        }
      }

      // Add index for review_user_id
      try {
        await query('CREATE INDEX IF NOT EXISTS idx_analyzed_shorts_review_user_id ON analyzed_shorts(review_user_id)');
        await query('CREATE INDEX IF NOT EXISTS idx_analyzed_shorts_reviewed_at ON analyzed_shorts(reviewed_at)');
        console.log('Added indexes for review columns');
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.warn('Could not create indexes:', error.message);
        }
      }
    }

    console.log('Analyzed shorts review migration completed successfully');
  } catch (error) {
    console.error('Analyzed shorts review migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateAnalyzedShortsReview()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

