import { query } from './index';
import dotenv from 'dotenv';

dotenv.config();

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL;
  return dbUrl?.startsWith('sqlite://') || false;
}

export async function removeScriptPipelineColumns(): Promise<void> {
  try {
    if (isSqlite()) {
      console.log('SQLite detected: Script pipeline columns removal skipped (SQLite does not support DROP COLUMN easily)');
      return;
    }

    const columns = [
      'script_first_draft',
      'script_second_draft',
      'script_final_draft',
      'script_draft_stage',
      'script_pipeline_notes',
      'first_draft_completed_at',
      'second_draft_completed_at',
      'final_draft_completed_at',
    ];

    for (const col of columns) {
      try {
        await query(`ALTER TABLE shorts DROP COLUMN IF EXISTS ${col}`);
        console.log(`Dropped column: ${col}`);
      } catch (error: any) {
        console.log(`Note: Could not drop column ${col}: ${error.message}`);
      }
    }

    console.log('Script pipeline columns removal completed successfully');
  } catch (error) {
    console.error('Remove script pipeline columns migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  removeScriptPipelineColumns()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
