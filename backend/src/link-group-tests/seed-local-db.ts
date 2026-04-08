/**
 * Seed the local SQLite DB with all link-group test fixtures, with expected
 * link_groups pre-assigned so you can view them visually in the app.
 *
 * Usage: cd backend && npx tsx src/link-group-tests/seed-local-db.ts
 *
 * This script is idempotent — safe to run multiple times.
 * It deletes and re-inserts all test shorts and their scenes.
 */
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { query } from '../db';

dotenv.config();

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

interface SceneInput {
  id: number;
  scene_order: number;
  script_line: string;
  direction: string;
  clipper_notes?: string | null;
}

interface ShortInput {
  short_id: number;
  title: string;
  scenes: SceneInput[];
}

interface LinkGroupEntry {
  scene_id: number;
  link_group: string;
}

interface Fixture {
  input: ShortInput;
  expected: LinkGroupEntry[];
}

function loadAllFixtures(): Fixture[] {
  const files = fs.readdirSync(FIXTURES_DIR);
  const inputFiles = files.filter(f => f.endsWith('.input.json')).sort();

  const fixtures: Fixture[] = [];
  for (const inputFile of inputFiles) {
    const name = inputFile.replace('.input.json', '');
    const expectedPath = path.join(FIXTURES_DIR, name + '.expected.json');
    if (!fs.existsSync(expectedPath)) {
      console.warn(`  [SKIP] No expected file for ${name}`);
      continue;
    }
    const input: ShortInput = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, inputFile), 'utf-8'));
    const expected: LinkGroupEntry[] = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
    fixtures.push({ input, expected });
  }
  return fixtures;
}

async function seed() {
  const fixtures = loadAllFixtures();
  if (fixtures.length === 0) {
    console.error('No complete fixture pairs found.');
    process.exit(1);
  }

  console.log(`\nSeeding ${fixtures.length} test shorts into local DB...\n`);

  // Run migrations first to ensure schema is up to date
  const { migrate } = await import('../db/migrate');
  await migrate();

  for (const fixture of fixtures) {
    const { input, expected } = fixture;
    const shortId = input.short_id;

    // Build expected link_group lookup
    const linkGroupMap = new Map<number, string>();
    for (const e of expected) linkGroupMap.set(e.scene_id, e.link_group);

    // Delete existing data for this short
    await query(`DELETE FROM scenes WHERE short_id = $1`, [shortId]);
    await query(`DELETE FROM shorts WHERE id = $1`, [shortId]);

    // Build script_content from scene script_lines
    const scriptContent = input.scenes
      .sort((a, b) => a.scene_order - b.scene_order)
      .map(s => s.script_line)
      .filter(Boolean)
      .join(' ');

    // Insert the short (using its real ID)
    await query(
      `INSERT INTO shorts (id, title, status, script_writer_id, script_content) VALUES ($1, $2, $3, $4, $5)`,
      [shortId, input.title, 'clips', null, scriptContent]
    );

    // Insert scenes with expected link_groups
    for (const scene of input.scenes) {
      const linkGroup = linkGroupMap.get(scene.id) ?? null;
      await query(
        `INSERT INTO scenes (id, short_id, scene_order, script_line, direction, clipper_notes, link_group)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          scene.id,
          shortId,
          scene.scene_order,
          scene.script_line,
          scene.direction ?? '',
          scene.clipper_notes ?? null,
          linkGroup,
        ]
      );
    }

    const groupCount = new Set(expected.map(e => e.link_group)).size;
    const groupedCount = expected.length;
    console.log(`  [${shortId}] "${input.title}" — ${input.scenes.length} scenes, ${groupedCount} in ${groupCount} groups`);
  }

  console.log(`\nDone. Open the app and navigate to each short to see link groups.\n`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
