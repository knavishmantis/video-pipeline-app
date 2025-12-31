import { Pool } from 'pg';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

let pool: Pool | null = null;
let sqliteDb: Database.Database | null = null;

function isSqlite(url: string): boolean {
  return url.startsWith('sqlite://');
}

function getSqlitePath(url: string): string {
  const match = url.match(/^sqlite:\/\/(.+)$/);
  if (!match) {
    throw new Error('Invalid SQLite URL format. Use: sqlite://./path/to/db.db');
  }
  const dbPath = match[1];
  // Resolve relative paths
  if (dbPath.startsWith('./') || dbPath.startsWith('../')) {
    return path.resolve(process.cwd(), dbPath);
  }
  return dbPath;
}

// Unified database interface
interface DatabaseInterface {
  query: (text: string, params?: any[]) => Promise<any>;
}

let dbInterface: DatabaseInterface | null = null;

export function getPool(): DatabaseInterface {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  if (!dbInterface) {
    if (isSqlite(dbUrl)) {
      if (!sqliteDb) {
        const dbPath = getSqlitePath(dbUrl);
        sqliteDb = new Database(dbPath);
        sqliteDb.pragma('foreign_keys = ON');
      }
      
      dbInterface = {
        query: async (text: string, params?: any[]) => {
          // Convert PostgreSQL placeholders ($1, $2, etc.) to SQLite placeholders (?)
          let sql = text;
          if (params && params.length > 0) {
            // Replace $1, $2, etc. with ?
            sql = text.replace(/\$(\d+)/g, '?');
            const stmt = sqliteDb!.prepare(sql);
            if (text.trim().toUpperCase().startsWith('SELECT')) {
              return { rows: stmt.all(...params) };
            } else {
              const result = stmt.run(...params);
              return { 
                rows: result.changes > 0 ? [{ id: result.lastInsertRowid }] : [],
                rowCount: result.changes 
              };
            }
          } else {
            if (text.trim().toUpperCase().startsWith('SELECT')) {
              return { rows: sqliteDb!.prepare(sql).all() };
            } else {
              const result = sqliteDb!.prepare(sql).run();
              return { 
                rows: result.changes > 0 ? [{ id: result.lastInsertRowid }] : [],
                rowCount: result.changes 
              };
            }
          }
        }
      };
    } else {
      if (!pool) {
        pool = new Pool({ connectionString: dbUrl });
      }
      
      dbInterface = {
        query: async (text: string, params?: any[]) => {
          return await pool!.query(text, params);
        }
      };
    }
  }
  
  return dbInterface;
}

// Wrapper function for direct use
export async function query(text: string, params?: any[]): Promise<any> {
  const db = getPool();
  return await db.query(text, params);
}

export async function initDatabase(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const db = getPool();
  try {
    if (isSqlite(dbUrl)) {
      await db.query('SELECT 1');
      console.log('SQLite database connected successfully');
    } else {
      await db.query('SELECT NOW()');
      console.log('PostgreSQL database connected successfully');
    }
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
}
