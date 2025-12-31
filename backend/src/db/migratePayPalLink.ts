import { query } from './index';
import dotenv from 'dotenv';

dotenv.config();

const MIGRATE_PAYPAL_PG = `
-- Add PayPal transaction link to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS paypal_transaction_link TEXT;
`;

function isSqlite(): boolean {
  const dbUrl = process.env.DATABASE_URL;
  return dbUrl?.startsWith('sqlite://') || false;
}

export async function migratePayPalLink(): Promise<void> {
  try {
    if (isSqlite()) {
      try {
        await query(`ALTER TABLE payments ADD COLUMN paypal_transaction_link TEXT`);
      } catch (error: any) {
        if (!error.message?.includes('duplicate column')) {
          throw error;
        }
      }
    } else {
      const statements = MIGRATE_PAYPAL_PG.split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      for (const statement of statements) {
        await query(statement);
      }
    }
    
    console.log('PayPal link migration completed successfully');
  } catch (error) {
    console.error('PayPal link migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migratePayPalLink()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

