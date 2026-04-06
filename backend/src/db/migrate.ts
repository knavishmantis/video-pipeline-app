import { query } from './index';

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL || '';
  return dbUrl.startsWith('sqlite://');
}

// PostgreSQL version - Complete schema with all features
const CREATE_TABLES_PG = `
-- Users table (with all columns)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),
  role VARCHAR(50) CHECK (role IN ('admin', 'script_writer', 'clipper', 'editor', 'sample_clipper')),
  discord_username VARCHAR(255),
  paypal_email VARCHAR(255),
  google_account VARCHAR(255),
  profile_picture VARCHAR(500),
  timezone VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User roles junction table (many-to-many for multiple roles)
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'script_writer', 'clipper', 'editor', 'sample_clipper')),
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sample assignments (prospect clippers doing a trial sample)
CREATE TABLE IF NOT EXISTS sample_assignments (
  id SERIAL PRIMARY KEY,
  source_short_id INTEGER NOT NULL REFERENCES shorts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prospect_email VARCHAR(255) NOT NULL,
  prospect_name VARCHAR(255) NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  submitted_at TIMESTAMP,
  submission_bucket_path TEXT,
  submission_file_name VARCHAR(255),
  submission_file_size BIGINT,
  review_status VARCHAR(20) CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMP,
  promoted_at TIMESTAMP
);

-- Junction table linking sample assignments to specific scenes of the source short
CREATE TABLE IF NOT EXISTS sample_assignment_scenes (
  sample_assignment_id INTEGER NOT NULL REFERENCES sample_assignments(id) ON DELETE CASCADE,
  scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL,
  PRIMARY KEY (sample_assignment_id, scene_id)
);

-- Shorts table
CREATE TABLE IF NOT EXISTS shorts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  idea TEXT,
  script_content TEXT,
  script_writer_id INTEGER REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'script', 'clipping', 'clips', 'clip_changes', 'editing', 'editing_changes', 'completed', 'uploaded')),
  youtube_video_id VARCHAR(20),
  entered_clip_changes_at TIMESTAMP,
  entered_editing_changes_at TIMESTAMP,
  clips_completed_at TIMESTAMP,
  editing_completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Assignments table (with rate columns)
CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  short_id INTEGER NOT NULL REFERENCES shorts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('clipper', 'editor', 'script_writer')),
  due_date TIMESTAMP,
  default_time_range INTEGER DEFAULT 2, -- hours
  rate DECIMAL(10, 2),
  rate_description TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(short_id, role)
);

-- Files table (GCP Storage references - with all file types)
CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  short_id INTEGER NOT NULL REFERENCES shorts(id) ON DELETE CASCADE,
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('script', 'script_pdf', 'clip', 'clips_zip', 'audio', 'final_video', 'profile_picture')),
  gcp_bucket_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments table (with all payment columns)
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  short_id INTEGER REFERENCES shorts(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  role VARCHAR(50) CHECK (role IN ('clipper', 'editor', 'incentive')),
  rate_description TEXT,
  completed_at TIMESTAMP,
  assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
  paypal_transaction_link TEXT,
  admin_notes TEXT,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scenes table (script broken into per-scene lines with directions)
CREATE TABLE IF NOT EXISTS scenes (
  id SERIAL PRIMARY KEY,
  short_id INTEGER NOT NULL REFERENCES shorts(id) ON DELETE CASCADE,
  scene_order INTEGER NOT NULL,
  script_line TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL DEFAULT '',
  clipper_notes TEXT,
  editor_notes TEXT,
  image_url TEXT,
  preset_clip_id INTEGER REFERENCES preset_clips(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Preset clips (reusable video clips referenced by scenes)
CREATE TABLE IF NOT EXISTS preset_clips (
  id SERIAL PRIMARY KEY,
  label VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  bucket_path TEXT NOT NULL,
  thumbnail_path TEXT,
  mime_type VARCHAR(100),
  file_size BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scene images (multiple images per scene)
CREATE TABLE IF NOT EXISTS scene_images (
  id SERIAL PRIMARY KEY,
  scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  bucket_path TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- YouTube video analytics (synced by GitHub Action via sync_youtube_analytics.py)
CREATE TABLE IF NOT EXISTS youtube_video_analytics (
  video_id VARCHAR(20) PRIMARY KEY,
  title TEXT NOT NULL,
  published_at TIMESTAMP,
  duration_sec INTEGER,
  is_short BOOLEAN DEFAULT true,
  views BIGINT DEFAULT 0,
  estimated_minutes_watched DECIMAL(12,2) DEFAULT 0,
  average_view_duration DECIMAL(10,2) DEFAULT 0,
  average_view_percentage DECIMAL(6,2) DEFAULT 0,
  likes INTEGER DEFAULT 0,
  dislikes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  subscribers_gained INTEGER DEFAULT 0,
  subscribers_lost INTEGER DEFAULT 0,
  like_rate DECIMAL(10,6) DEFAULT 0,
  comment_rate DECIMAL(10,6) DEFAULT 0,
  share_rate DECIMAL(10,6) DEFAULT 0,
  sub_gain_rate DECIMAL(10,6) DEFAULT 0,
  engagement_rate DECIMAL(10,6) DEFAULT 0,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scenes_short_id ON scenes(short_id);
CREATE INDEX IF NOT EXISTS idx_scenes_order ON scenes(short_id, scene_order);
CREATE INDEX IF NOT EXISTS idx_scene_images_scene_id ON scene_images(scene_id);
CREATE INDEX IF NOT EXISTS idx_shorts_status ON shorts(status);
CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_short_id ON assignments(short_id);
CREATE INDEX IF NOT EXISTS idx_files_short_id ON files(short_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_sample_assignments_email ON sample_assignments(prospect_email);
CREATE INDEX IF NOT EXISTS idx_sample_assignments_user_id ON sample_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_sample_assignments_source_short ON sample_assignments(source_short_id);
CREATE INDEX IF NOT EXISTS idx_sample_assignment_scenes_assignment ON sample_assignment_scenes(sample_assignment_id);
`;

// SQLite version (SERIAL -> INTEGER PRIMARY KEY AUTOINCREMENT, other SERIAL -> INTEGER)
const CREATE_TABLES_SQLITE = CREATE_TABLES_PG
  .replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
  .replace(/\bSERIAL\b/g, 'INTEGER');

export async function migrate(): Promise<void> {
  try {
    const sql = isSqlite() ? CREATE_TABLES_SQLITE : CREATE_TABLES_PG;
    // Split by semicolon and execute each statement
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    
    for (const statement of statements) {
      try {
        await query(statement);
      } catch (error: any) {
        // Ignore errors for existing tables/indexes
        if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
          throw error;
        }
      }
    }
    
    // Update constraints for existing tables (PostgreSQL only)
    if (!isSqlite()) {
      // Update files table file_type constraint to include clips_zip
      try {
        await query('ALTER TABLE files DROP CONSTRAINT IF EXISTS files_file_type_check');
        await query(`
          ALTER TABLE files 
          ADD CONSTRAINT files_file_type_check 
          CHECK (file_type IN ('script', 'script_pdf', 'clip', 'clips_zip', 'audio', 'final_video', 'profile_picture', 'scene_image'))
        `);
        console.log('Updated files_file_type_check constraint');
      } catch (error: any) {
        // Constraint might not exist or already be updated
        if (!error.message.includes('does not exist') && !error.message.includes('already exists')) {
          console.warn('Could not update files_file_type_check constraint:', error.message);
        }
      }
      
      // Update shorts table status constraint (without ready_to_upload)
      try {
        await query('ALTER TABLE shorts DROP CONSTRAINT IF EXISTS shorts_status_check');
        await query(`
          ALTER TABLE shorts
          ADD CONSTRAINT shorts_status_check
          CHECK (status IN ('idea', 'script', 'clipping', 'clips', 'clip_changes', 'editing', 'editing_changes', 'completed', 'uploaded'))
        `);
        // Migrate any legacy ready_to_upload rows to completed
        await query("UPDATE shorts SET status = 'completed' WHERE status = 'ready_to_upload'");
        console.log('Updated shorts_status_check constraint');
      } catch (error: any) {
        // Constraint might not exist or already be updated
        if (!error.message.includes('does not exist') && !error.message.includes('already exists')) {
          console.warn('Could not update shorts_status_check constraint:', error.message);
        }
      }

      // Create scene_images table and migrate legacy image_url data
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS scene_images (
            id SERIAL PRIMARY KEY,
            scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
            bucket_path TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await query('CREATE INDEX IF NOT EXISTS idx_scene_images_scene_id ON scene_images(scene_id)');
        // Migrate existing image_url values into scene_images (idempotent)
        await query(`
          INSERT INTO scene_images (scene_id, bucket_path)
          SELECT id, image_url FROM scenes
          WHERE image_url IS NOT NULL
            AND id NOT IN (SELECT scene_id FROM scene_images)
        `);
        console.log('Created scene_images table and migrated legacy image_url data');
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.warn('Could not create scene_images table:', error.message);
        }
      }

      // Create preset_clips table and add preset_clip_id to scenes
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
        await query('ALTER TABLE scenes ADD COLUMN IF NOT EXISTS preset_clip_id INTEGER REFERENCES preset_clips(id) ON DELETE SET NULL');
        await query('CREATE INDEX IF NOT EXISTS idx_scenes_preset_clip_id ON scenes(preset_clip_id)');
        console.log('Created preset_clips table and added preset_clip_id to scenes');
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.warn('Could not create preset_clips table:', error.message);
        }
      }

      // Add label column to preset_clips and backfill
      try {
        await query('ALTER TABLE preset_clips ADD COLUMN IF NOT EXISTS label VARCHAR(50)');
        // Backfill unlabeled presets with sequential numbers based on creation order
        await query(`
          UPDATE preset_clips SET label = sub.new_label
          FROM (
            SELECT id, CAST(ROW_NUMBER() OVER (ORDER BY created_at ASC) AS TEXT) AS new_label
            FROM preset_clips WHERE label IS NULL
          ) sub
          WHERE preset_clips.id = sub.id
        `);
        console.log('Added label column to preset_clips');
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.warn('Could not add label column:', error.message);
        }
      }

      // Add thumbnail_path column to preset_clips
      try {
        await query('ALTER TABLE preset_clips ADD COLUMN IF NOT EXISTS thumbnail_path TEXT');
        console.log('Added thumbnail_path column to preset_clips');
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.warn('Could not add thumbnail_path column:', error.message);
        }
      }

      // Add is_active column to shorts
      try {
        await query(`ALTER TABLE shorts ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE`);
        console.log('Added is_active column to shorts');
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.warn('Could not add is_active column to shorts:', error.message);
        }
      }

      // Add file_type column to scene_images
      try {
        await query(`ALTER TABLE scene_images ADD COLUMN IF NOT EXISTS file_type VARCHAR(20) NOT NULL DEFAULT 'image'`);
        console.log('Added file_type column to scene_images');
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.warn('Could not add file_type column to scene_images:', error.message);
        }
      }

      // Add timestamp and youtube columns
      try {
        await query('ALTER TABLE shorts ADD COLUMN IF NOT EXISTS entered_clip_changes_at TIMESTAMP');
        await query('ALTER TABLE shorts ADD COLUMN IF NOT EXISTS entered_editing_changes_at TIMESTAMP');
        await query('ALTER TABLE shorts ADD COLUMN IF NOT EXISTS clips_completed_at TIMESTAMP');
        await query('ALTER TABLE shorts ADD COLUMN IF NOT EXISTS editing_completed_at TIMESTAMP');
        await query('ALTER TABLE shorts ADD COLUMN IF NOT EXISTS youtube_video_id VARCHAR(20)');
        console.log('Added timestamp and youtube_video_id columns');
      } catch (error: any) {
        console.warn('Could not add columns (may already exist):', error.message);
      }

      // Add needs_rework flag to scenes
      try {
        await query(`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS needs_rework BOOLEAN NOT NULL DEFAULT FALSE`);
        console.log('Added needs_rework column to scenes');
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.warn('Could not add needs_rework column:', error.message);
        }
      }

      // Add clipper_checked and link_group to scenes
      try {
        await query(`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS clipper_checked BOOLEAN NOT NULL DEFAULT FALSE`);
        await query(`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS link_group TEXT`);
        console.log('Added clipper_checked and link_group columns to scenes');
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.warn('Could not add clipper_checked/link_group columns:', error.message);
        }
      }

      // Expand role CHECK constraints to include 'sample_clipper'
      try {
        await query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        await query(`
          ALTER TABLE users
          ADD CONSTRAINT users_role_check
          CHECK (role IN ('admin', 'script_writer', 'clipper', 'editor', 'sample_clipper'))
        `);
        await query('ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check');
        await query(`
          ALTER TABLE user_roles
          ADD CONSTRAINT user_roles_role_check
          CHECK (role IN ('admin', 'script_writer', 'clipper', 'editor', 'sample_clipper'))
        `);
        console.log('Updated role CHECK constraints to include sample_clipper');
      } catch (error: any) {
        if (!error.message.includes('does not exist') && !error.message.includes('already exists')) {
          console.warn('Could not update role CHECK constraints:', error.message);
        }
      }

      // Drop legacy scene_ids column from sample_assignments (earlier iteration had it NOT NULL)
      try {
        await query('ALTER TABLE sample_assignments DROP COLUMN IF EXISTS scene_ids');
      } catch (error: any) {
        // Table might not exist yet
        if (!error.message.includes('does not exist')) {
          console.warn('Could not drop legacy sample_assignments.scene_ids column:', error.message);
        }
      }

      // Add research_brief column to shorts
      try {
        await query('ALTER TABLE shorts ADD COLUMN IF NOT EXISTS research_brief TEXT');
        console.log('Added research_brief column to shorts');
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.warn('Could not add research_brief column:', error.message);
        }
      }

      // Add promoted_at column for tracking prospects promoted to real clippers
      try {
        await query('ALTER TABLE sample_assignments ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP');
      } catch (error: any) {
        if (!error.message.includes('already exists') && !error.message.includes('does not exist')) {
          console.warn('Could not add promoted_at column:', error.message);
        }
      }

      // Create sample_assignments + sample_assignment_scenes (may not exist on older DBs)
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS sample_assignments (
            id SERIAL PRIMARY KEY,
            source_short_id INTEGER NOT NULL REFERENCES shorts(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            prospect_email VARCHAR(255) NOT NULL,
            prospect_name VARCHAR(255) NOT NULL,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            submitted_at TIMESTAMP,
            submission_bucket_path TEXT,
            submission_file_name VARCHAR(255),
            submission_file_size BIGINT,
            review_status VARCHAR(20) CHECK (review_status IN ('pending', 'approved', 'rejected')),
            reviewed_at TIMESTAMP,
            promoted_at TIMESTAMP
          )
        `);
        await query(`
          CREATE TABLE IF NOT EXISTS sample_assignment_scenes (
            sample_assignment_id INTEGER NOT NULL REFERENCES sample_assignments(id) ON DELETE CASCADE,
            scene_id INTEGER NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
            display_order INTEGER NOT NULL,
            PRIMARY KEY (sample_assignment_id, scene_id)
          )
        `);
        await query('CREATE INDEX IF NOT EXISTS idx_sample_assignments_email ON sample_assignments(prospect_email)');
        await query('CREATE INDEX IF NOT EXISTS idx_sample_assignments_user_id ON sample_assignments(user_id)');
        await query('CREATE INDEX IF NOT EXISTS idx_sample_assignments_source_short ON sample_assignments(source_short_id)');
        await query('CREATE INDEX IF NOT EXISTS idx_sample_assignment_scenes_assignment ON sample_assignment_scenes(sample_assignment_id)');
        console.log('Ensured sample_assignments + sample_assignment_scenes tables exist');
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.warn('Could not create sample_assignments tables:', error.message);
        }
      }
    }
    
    console.log('Database migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

