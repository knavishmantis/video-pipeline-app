import { query } from './index';

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL || '';
  return dbUrl.startsWith('sqlite://');
}

export async function migrateScenes(): Promise<void> {
  try {
    if (isSqlite()) {
      await query(`
        CREATE TABLE IF NOT EXISTS scenes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          short_id INTEGER NOT NULL REFERENCES shorts(id) ON DELETE CASCADE,
          scene_order INTEGER NOT NULL,
          script_line TEXT NOT NULL DEFAULT '',
          direction TEXT NOT NULL DEFAULT '',
          clipper_notes TEXT,
          editor_notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      await query(`
        CREATE TABLE IF NOT EXISTS scenes (
          id SERIAL PRIMARY KEY,
          short_id INTEGER NOT NULL REFERENCES shorts(id) ON DELETE CASCADE,
          scene_order INTEGER NOT NULL,
          script_line TEXT NOT NULL DEFAULT '',
          direction TEXT NOT NULL DEFAULT '',
          clipper_notes TEXT,
          editor_notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    try {
      await query('CREATE INDEX IF NOT EXISTS idx_scenes_short_id ON scenes(short_id)');
      await query('CREATE INDEX IF NOT EXISTS idx_scenes_order ON scenes(short_id, scene_order)');
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }

    // Add image_url column if not exists
    try {
      await query('ALTER TABLE scenes ADD COLUMN IF NOT EXISTS image_url TEXT');
      console.log('Added image_url column to scenes');
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        console.warn('Could not add image_url column:', error.message);
      }
    }

    console.log('Scenes migration completed successfully');
  } catch (error) {
    console.error('Scenes migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  migrateScenes()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
