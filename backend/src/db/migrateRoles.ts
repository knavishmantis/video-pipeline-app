import { query } from './index';

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL || '';
  return dbUrl.startsWith('sqlite://');
}

// Migration to support multiple roles
const MIGRATE_ROLES = `
-- User roles junction table (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'script_writer', 'clipper', 'editor')),
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Migrate existing single role to user_roles
INSERT INTO user_roles (user_id, role)
SELECT id, role FROM users
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles ur WHERE ur.user_id = users.id AND ur.role = users.role
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
`;

export async function migrateRoles(): Promise<void> {
  try {
    const sql = isSqlite() 
      ? MIGRATE_ROLES.replace(/SERIAL/g, 'INTEGER')
      : MIGRATE_ROLES;
    
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    
    for (const statement of statements) {
      try {
        await query(statement);
      } catch (error: any) {
        // Ignore errors for existing tables/indexes
        if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
          console.warn('Migration statement warning:', error.message);
        }
      }
    }
    
    console.log('Roles migration completed successfully');
  } catch (error) {
    console.error('Roles migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateRoles()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

