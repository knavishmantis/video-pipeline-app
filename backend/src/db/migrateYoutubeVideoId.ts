import { query } from './index';
import dotenv from 'dotenv';

dotenv.config();

export async function migrateYoutubeVideoId(): Promise<void> {
  try {
    await query(`
      ALTER TABLE shorts ADD COLUMN IF NOT EXISTS youtube_video_id VARCHAR(20)
    `);
    console.log('youtube_video_id column added to shorts table');
  } catch (error) {
    console.error('migrateYoutubeVideoId failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateYoutubeVideoId()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
