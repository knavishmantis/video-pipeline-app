import { Pool } from 'pg';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Safe logger import - handle case where logger might not be initialized
let logger: any;
try {
  logger = require('../utils/logger').logger;
} catch (error) {
  // Fallback logger if module fails to load
  logger = {
    debug: (...args: any[]) => console.log('[DEBUG]', ...args),
    info: (...args: any[]) => console.log('[INFO]', ...args),
    error: (...args: any[]) => console.error('[ERROR]', ...args),
  };
}

let pool: Pool | null = null;
let sqliteDb: Database.Database | null = null;

// Simple in-memory cache implementation
interface CacheEntry {
  value: any;
  expiresAt: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private defaultTtl: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxSize: number = 1000, defaultTtl: number = 300000) {
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl; // in milliseconds
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    this.hits++;
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<T> {
    // Evict oldest entries if at max size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      // Remove first (oldest) entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const expiresAt = Date.now() + (ttl || this.defaultTtl);
    this.cache.set(key, { value, expiresAt });
    return value;
  }

  async clear(): Promise<boolean> {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    return true;
  }

  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(2) : '0.00';
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
      totalRequests: total
    };
  }
}

let cache: SimpleCache | null = null;

// Initialize cache if enabled
function getCache(): SimpleCache | null {
  const cacheEnabled = process.env.ENABLE_QUERY_CACHE !== 'false'; // Default to enabled
  const cacheTtl = parseInt(process.env.QUERY_CACHE_TTL || '300', 10); // Default 5 minutes

  if (!cacheEnabled) {
    return null;
  }

  if (!cache) {
    const maxSize = parseInt(process.env.QUERY_CACHE_MAX_SIZE || '1000', 10);
    cache = new SimpleCache(maxSize, cacheTtl * 1000);
  }

  return cache;
}

// Generate cache key from SQL query and parameters
function getCacheKey(sql: string, params?: any[]): string {
  const paramsStr = params ? JSON.stringify(params) : '';
  return `query:${sql}:${paramsStr}`;
}

// Check if query is a SELECT statement
function isSelectQuery(sql: string): boolean {
  return sql.trim().toUpperCase().startsWith('SELECT');
}

// Check if query modifies data (should invalidate cache)
function isWriteQuery(sql: string): boolean {
  const upperSql = sql.trim().toUpperCase();
  return (
    upperSql.startsWith('INSERT') ||
    upperSql.startsWith('UPDATE') ||
    upperSql.startsWith('DELETE') ||
    upperSql.startsWith('TRUNCATE') ||
    upperSql.startsWith('DROP') ||
    upperSql.startsWith('CREATE') ||
    upperSql.startsWith('ALTER')
  );
}

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
          const queryCache = getCache();
          const cacheKey = getCacheKey(text, params);
          
          // Try to get from cache for SELECT queries
          if (isSelectQuery(text) && queryCache) {
            const cached = await queryCache.get(cacheKey);
            if (cached) {
              if (process.env.LOG_CACHE_HITS === 'true') {
                logger.debug('Cache HIT', { sql: text.substring(0, 100), params });
              }
              return cached;
            }
            if (process.env.LOG_CACHE_MISSES === 'true') {
              logger.debug('Cache MISS', { sql: text.substring(0, 100), params });
            }
          }

          // Convert PostgreSQL placeholders ($1, $2, etc.) to SQLite placeholders (?)
          let sql = text;
          let result: any;
          
          if (params && params.length > 0) {
            // Replace $1, $2, etc. with ?
            sql = text.replace(/\$(\d+)/g, '?');
            const stmt = sqliteDb!.prepare(sql);
            if (isSelectQuery(text)) {
              result = { rows: stmt.all(...params) };
            } else {
              const dbResult = stmt.run(...params);
              result = { 
                rows: dbResult.changes > 0 ? [{ id: dbResult.lastInsertRowid }] : [],
                rowCount: dbResult.changes 
              };
            }
          } else {
            if (isSelectQuery(text)) {
              result = { rows: sqliteDb!.prepare(sql).all() };
            } else {
              const dbResult = sqliteDb!.prepare(sql).run();
              result = { 
                rows: dbResult.changes > 0 ? [{ id: dbResult.lastInsertRowid }] : [],
                rowCount: dbResult.changes 
              };
            }
          }

          // Cache SELECT query results
          if (isSelectQuery(text) && queryCache) {
            await queryCache.set(cacheKey, result);
            if (process.env.LOG_CACHE_STORES === 'true') {
              logger.debug('Cache STORE', { sql: text.substring(0, 100), params });
            }
          }

          // Invalidate cache on write operations
          if (isWriteQuery(text) && queryCache) {
            await queryCache.clear(); // Clear entire cache on writes (simple approach)
            if (process.env.LOG_CACHE_INVALIDATION === 'true') {
              logger.info('Cache INVALIDATED', { sql: text.substring(0, 100) });
            }
          }

          return result;
        }
      };
    } else {
      if (!pool) {
        pool = new Pool({ connectionString: dbUrl });
      }
      
      dbInterface = {
        query: async (text: string, params?: any[]) => {
          const queryCache = getCache();
          const cacheKey = getCacheKey(text, params);
          
          // Try to get from cache for SELECT queries
          if (isSelectQuery(text) && queryCache) {
            const cached = await queryCache.get(cacheKey);
            if (cached) {
              if (process.env.LOG_CACHE_HITS === 'true') {
                logger.debug('Cache HIT', { sql: text.substring(0, 100), params });
              }
              return cached;
            }
            if (process.env.LOG_CACHE_MISSES === 'true') {
              logger.debug('Cache MISS', { sql: text.substring(0, 100), params });
            }
          }

          // Execute query
          const result = await pool!.query(text, params);

          // Cache SELECT query results
          if (isSelectQuery(text) && queryCache) {
            await queryCache.set(cacheKey, result);
            if (process.env.LOG_CACHE_STORES === 'true') {
              logger.debug('Cache STORE', { sql: text.substring(0, 100), params });
            }
          }

          // Invalidate cache on write operations
          if (isWriteQuery(text) && queryCache) {
            await queryCache.clear(); // Clear entire cache on writes (simple approach)
            if (process.env.LOG_CACHE_INVALIDATION === 'true') {
              logger.info('Cache INVALIDATED', { sql: text.substring(0, 100) });
            }
          }

          return result;
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
  if (cache) {
    await cache.clear();
    cache = null;
  }
}

// Export function to manually clear cache (useful for testing or manual invalidation)
export async function clearCache(): Promise<void> {
  const queryCache = getCache();
  if (queryCache) {
    await queryCache.clear();
    logger.info('Cache manually cleared');
  }
}

// Export function to get cache statistics
export function getCacheStats(): any {
  const queryCache = getCache();
  if (queryCache) {
    return queryCache.getStats();
  }
  return { enabled: false };
}
