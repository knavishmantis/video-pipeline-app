import { query } from './index';

export async function migrateWorlds(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS worlds (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        bucket_path TEXT NOT NULL,
        screenshot_path TEXT,
        file_size BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created worlds table');

    await query('ALTER TABLE scenes ADD COLUMN IF NOT EXISTS world_id INTEGER REFERENCES worlds(id) ON DELETE SET NULL');
    console.log('Added world_id column to scenes');

    await query('CREATE INDEX IF NOT EXISTS idx_scenes_world_id ON scenes(world_id)');
    console.log('Created index on scenes.world_id');

    console.log('Worlds migration completed successfully');
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log('Worlds migration: already up to date');
    } else {
      console.error('Worlds migration failed:', error);
      throw error;
    }
  }
}

if (require.main === module) {
  migrateWorlds()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
