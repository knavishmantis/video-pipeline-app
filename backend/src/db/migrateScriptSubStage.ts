import { query } from './index';

export async function migrateScriptSubStage(): Promise<void> {
  try {
    await query(`ALTER TABLE shorts ADD COLUMN IF NOT EXISTS script_sub_stage VARCHAR(20)`);
    console.log('migrateScriptSubStage: script_sub_stage column added (or already exists)');
  } catch (error: any) {
    if (!error.message?.includes('already exists')) {
      console.error('migrateScriptSubStage failed:', error);
      throw error;
    }
  }
}

if (require.main === module) {
  migrateScriptSubStage()
    .then(() => process.exit(0))
    .catch(e => { console.error(e); process.exit(1); });
}
