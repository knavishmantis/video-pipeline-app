/**
 * Simple script to test if query caching is working
 * Run with: tsx scripts/test-cache.ts
 */

import { query, getCacheStats, clearCache } from '../src/db';
import dotenv from 'dotenv';

dotenv.config();

async function testCache() {
  console.log('🧪 Testing Query Cache...\n');

  // Clear cache first
  await clearCache();
  console.log('✅ Cache cleared\n');

  // Test 1: First query (should be a MISS)
  console.log('Test 1: First query (should be a MISS)');
  const start1 = Date.now();
  const result1 = await query('SELECT NOW() as current_time');
  const time1 = Date.now() - start1;
  console.log(`   Result: ${result1.rows[0].current_time}`);
  console.log(`   Time: ${time1}ms`);
  console.log(`   Stats:`, getCacheStats());
  console.log('');

  // Test 2: Same query immediately (should be a HIT)
  console.log('Test 2: Same query immediately (should be a HIT)');
  const start2 = Date.now();
  const result2 = await query('SELECT NOW() as current_time');
  const time2 = Date.now() - start2;
  console.log(`   Result: ${result2.rows[0].current_time}`);
  console.log(`   Time: ${time2}ms (should be much faster)`);
  console.log(`   Stats:`, getCacheStats());
  console.log('');

  // Test 3: Different query (should be a MISS)
  console.log('Test 3: Different query (should be a MISS)');
  const start3 = Date.now();
  const result3 = await query('SELECT 1 + 1 as sum');
  const time3 = Date.now() - start3;
  console.log(`   Result: ${result3.rows[0].sum}`);
  console.log(`   Time: ${time3}ms`);
  console.log(`   Stats:`, getCacheStats());
  console.log('');

  // Test 4: Same query again (should be a HIT)
  console.log('Test 4: First query again (should be a HIT)');
  const start4 = Date.now();
  const result4 = await query('SELECT NOW() as current_time');
  const time4 = Date.now() - start4;
  console.log(`   Result: ${result4.rows[0].current_time}`);
  console.log(`   Time: ${time4}ms (should be fast)`);
  console.log(`   Stats:`, getCacheStats());
  console.log('');

  // Final stats
  const finalStats = getCacheStats();
  console.log('📊 Final Cache Statistics:');
  console.log(JSON.stringify(finalStats, null, 2));
  console.log('');

  if (finalStats.hits > 0) {
    console.log('✅ Cache is working! You should see hits > 0');
  } else {
    console.log('⚠️  No cache hits detected. Check if ENABLE_QUERY_CACHE is set correctly.');
  }

  // Cleanup
  await clearCache();
  process.exit(0);
}

testCache().catch((error) => {
  console.error('❌ Error testing cache:', error);
  process.exit(1);
});

