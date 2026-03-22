import { query } from './index';

export async function migratePresetClips(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS preset_clips (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        bucket_path TEXT NOT NULL,
        mime_type VARCHAR(100),
        file_size BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created preset_clips table');

    await query('ALTER TABLE scenes ADD COLUMN IF NOT EXISTS preset_clip_id INTEGER REFERENCES preset_clips(id) ON DELETE SET NULL');
    console.log('Added preset_clip_id column to scenes');

    await query('CREATE INDEX IF NOT EXISTS idx_scenes_preset_clip_id ON scenes(preset_clip_id)');
    console.log('Created index on scenes.preset_clip_id');

    console.log('Preset clips migration completed successfully');
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log('Preset clips migration: already up to date');
    } else {
      console.error('Preset clips migration failed:', error);
      throw error;
    }
  }
}

if (require.main === module) {
  migratePresetClips()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
