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
  role VARCHAR(50) CHECK (role IN ('admin', 'script_writer', 'clipper', 'editor')),
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
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'script_writer', 'clipper', 'editor')),
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shorts_status ON shorts(status);
CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_short_id ON assignments(short_id);
CREATE INDEX IF NOT EXISTS idx_files_short_id ON files(short_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
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
          CHECK (file_type IN ('script', 'script_pdf', 'clip', 'clips_zip', 'audio', 'final_video', 'profile_picture'))
        `);
        console.log('Updated files_file_type_check constraint');
      } catch (error: any) {
        // Constraint might not exist or already be updated
        if (!error.message.includes('does not exist') && !error.message.includes('already exists')) {
          console.warn('Could not update files_file_type_check constraint:', error.message);
        }
      }
      
      // Update shorts table status constraint to include clips, clip_changes, and editing_changes
      try {
        await query('ALTER TABLE shorts DROP CONSTRAINT IF EXISTS shorts_status_check');
        await query(`
          ALTER TABLE shorts 
          ADD CONSTRAINT shorts_status_check 
          CHECK (status IN ('idea', 'script', 'clipping', 'clips', 'clip_changes', 'editing', 'editing_changes', 'completed', 'ready_to_upload', 'uploaded'))
        `);
        console.log('Updated shorts_status_check constraint');
      } catch (error: any) {
        // Constraint might not exist or already be updated
        if (!error.message.includes('does not exist') && !error.message.includes('already exists')) {
          console.warn('Could not update shorts_status_check constraint:', error.message);
        }
      }
      
      // Add timestamp columns for tracking when shorts entered clip_changes/editing_changes and completion
      try {
        await query('ALTER TABLE shorts ADD COLUMN IF NOT EXISTS entered_clip_changes_at TIMESTAMP');
        await query('ALTER TABLE shorts ADD COLUMN IF NOT EXISTS entered_editing_changes_at TIMESTAMP');
        await query('ALTER TABLE shorts ADD COLUMN IF NOT EXISTS clips_completed_at TIMESTAMP');
        await query('ALTER TABLE shorts ADD COLUMN IF NOT EXISTS editing_completed_at TIMESTAMP');
        console.log('Added timestamp columns for clip/editing changes and completion');
      } catch (error: any) {
        console.warn('Could not add timestamp columns (may already exist):', error.message);
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

