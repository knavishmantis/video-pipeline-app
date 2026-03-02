import { query } from './index';
import dotenv from 'dotenv';
dotenv.config();

export async function migrateReflection(): Promise<void> {
  await query(`ALTER TABLE shorts ADD COLUMN IF NOT EXISTS reflection_what_worked TEXT`);
  await query(`ALTER TABLE shorts ADD COLUMN IF NOT EXISTS reflection_what_didnt TEXT`);
  await query(`ALTER TABLE shorts ADD COLUMN IF NOT EXISTS reflection_would_do_differently TEXT`);
  await query(`ALTER TABLE shorts ADD COLUMN IF NOT EXISTS reflection_rating INTEGER`);
  await query(`ALTER TABLE shorts ADD COLUMN IF NOT EXISTS reflection_at TIMESTAMP`);
  console.log('Reflection columns added');
}

if (require.main === module) {
  migrateReflection().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
