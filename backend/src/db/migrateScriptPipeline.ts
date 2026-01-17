import { query } from './index';

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL || '';
  return dbUrl.startsWith('sqlite://');
}

export async function migrateScriptPipeline(): Promise<void> {
  try {
    if (isSqlite()) {
      // SQLite: Add columns using ALTER TABLE
      try {
        await query('ALTER TABLE shorts ADD COLUMN script_first_draft TEXT');
        console.log('Added script_first_draft column');
      } catch (error: any) {
        if (!error.message.includes('duplicate column')) {
          console.warn('Could not add script_first_draft column:', error.message);
        }
      }

      try {
        await query('ALTER TABLE shorts ADD COLUMN script_second_draft TEXT');
        console.log('Added script_second_draft column');
      } catch (error: any) {
        if (!error.message.includes('duplicate column')) {
          console.warn('Could not add script_second_draft column:', error.message);
        }
      }

      try {
        await query('ALTER TABLE shorts ADD COLUMN script_final_draft TEXT');
        console.log('Added script_final_draft column');
      } catch (error: any) {
        if (!error.message.includes('duplicate column')) {
          console.warn('Could not add script_final_draft column:', error.message);
        }
      }

      try {
        await query('ALTER TABLE shorts ADD COLUMN script_draft_stage VARCHAR(50)');
        console.log('Added script_draft_stage column');
      } catch (error: any) {
        if (!error.message.includes('duplicate column')) {
          console.warn('Could not add script_draft_stage column:', error.message);
        }
      }

      try {
        await query('ALTER TABLE shorts ADD COLUMN script_pipeline_notes TEXT');
        console.log('Added script_pipeline_notes column');
      } catch (error: any) {
        if (!error.message.includes('duplicate column')) {
          console.warn('Could not add script_pipeline_notes column:', error.message);
        }
      }

      try {
        await query('ALTER TABLE shorts ADD COLUMN first_draft_completed_at TIMESTAMP');
        console.log('Added first_draft_completed_at column');
      } catch (error: any) {
        if (!error.message.includes('duplicate column')) {
          console.warn('Could not add first_draft_completed_at column:', error.message);
        }
      }

      try {
        await query('ALTER TABLE shorts ADD COLUMN second_draft_completed_at TIMESTAMP');
        console.log('Added second_draft_completed_at column');
      } catch (error: any) {
        if (!error.message.includes('duplicate column')) {
          console.warn('Could not add second_draft_completed_at column:', error.message);
        }
      }

      try {
        await query('ALTER TABLE shorts ADD COLUMN final_draft_completed_at TIMESTAMP');
        console.log('Added final_draft_completed_at column');
      } catch (error: any) {
        if (!error.message.includes('duplicate column')) {
          console.warn('Could not add final_draft_completed_at column:', error.message);
        }
      }

      console.log('SQLite: Script pipeline migration completed');
      return;
    }

    // PostgreSQL: Add columns using ALTER TABLE IF NOT EXISTS equivalent
    const columns = [
      { name: 'script_first_draft', type: 'TEXT' },
      { name: 'script_second_draft', type: 'TEXT' },
      { name: 'script_final_draft', type: 'TEXT' },
      { name: 'script_draft_stage', type: 'VARCHAR(50)' },
      { name: 'script_pipeline_notes', type: 'TEXT' },
      { name: 'first_draft_completed_at', type: 'TIMESTAMP' },
      { name: 'second_draft_completed_at', type: 'TIMESTAMP' },
      { name: 'final_draft_completed_at', type: 'TIMESTAMP' },
    ];

    for (const col of columns) {
      try {
        // Check if column exists first
        const checkResult = await query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'shorts' AND column_name = $1
        `, [col.name]);

        if (checkResult.rows.length === 0) {
          await query(`ALTER TABLE shorts ADD COLUMN ${col.name} ${col.type}`);
          console.log(`Added ${col.name} column`);
        } else {
          console.log(`Column ${col.name} already exists, skipping`);
        }
      } catch (error: any) {
        // If column already exists, that's fine
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`Column ${col.name} already exists`);
        } else {
          console.warn(`Could not add ${col.name} column:`, error.message);
        }
      }
    }

    // Add index for script_draft_stage for better query performance
    try {
      await query('CREATE INDEX IF NOT EXISTS idx_shorts_script_draft_stage ON shorts(script_draft_stage)');
      console.log('Added index on script_draft_stage');
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        console.warn('Could not create index on script_draft_stage:', error.message);
      }
    }

    console.log('PostgreSQL: Script pipeline migration completed successfully');
  } catch (error) {
    console.error('Script pipeline migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateScriptPipeline()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

