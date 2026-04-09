import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

function getPool(): Pool {
  const mainDbUrl = process.env.DATABASE_URL || '';
  const host = mainDbUrl.match(/@([^:]+):/)?.[1] || '34.58.157.140';
  return new Pool({
    host,
    port: 5432,
    database: 'script_engine',
    user: 'script_engine',
    password: process.env.SCRIPT_ENGINE_DB_PASSWORD || 'MC@w@W_J:1?K{pUi(ht8mh)sUh4MzVfX',
    max: 3,
  });
}

function countSentences(text: string | null): number {
  if (!text || text.trim().length === 0) return 0;
  // Split on sentence-ending punctuation followed by space or end of string
  const sentences = text.trim().split(/[.!?]+\s*/g).filter(s => s.trim().length > 0);
  return sentences.length;
}

async function main() {
  const pool = getPool();

  try {
    // Get all reviews
    const reviews = await pool.query(`
      SELECT cr.id, cr.video_id, cr.initial_analysis, cr.hook_notes, cr.concept_notes,
             cr.pacing_notes, cr.payoff_notes, cr.steal_this, v.title
      FROM competitor_reviews cr
      JOIN videos v ON v.id = cr.video_id
      ORDER BY cr.reviewed_at DESC
    `);

    console.log(`Total reviewed: ${reviews.rows.length}\n`);

    const toDelete: { id: number; title: string; totalSentences: number; analysis: string }[] = [];

    for (const row of reviews.rows) {
      // Combine all text fields
      const allText = [
        row.initial_analysis,
        row.hook_notes,
        row.concept_notes,
        row.pacing_notes,
        row.payoff_notes,
      ].filter(Boolean).join(' ');

      const totalSentences = countSentences(allText);

      if (totalSentences < 3) {
        toDelete.push({
          id: row.id,
          title: row.title,
          totalSentences,
          analysis: allText.slice(0, 80) || '(empty)',
        });
      }
    }

    console.log(`Reviews with < 3 sentences of analysis: ${toDelete.length}`);
    console.log(`Reviews with sufficient analysis: ${reviews.rows.length - toDelete.length}\n`);

    if (toDelete.length === 0) {
      console.log('Nothing to clean up.');
      return;
    }

    // Show what will be deleted
    console.log('Will reset these to unreviewed:');
    for (const item of toDelete) {
      console.log(`  [${item.totalSentences} sentences] "${item.title}" — ${item.analysis}`);
    }

    const dryRun = process.argv.includes('--dry-run');
    if (dryRun) {
      console.log('\n--dry-run flag set, not deleting anything.');
      return;
    }

    // Delete reviews to reset to unreviewed
    const ids = toDelete.map(d => d.id);
    await pool.query(`DELETE FROM competitor_reviews WHERE id = ANY($1)`, [ids]);
    console.log(`\nDeleted ${ids.length} reviews. These videos are now unreviewed.`);

  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
