/**
 * Test runner for suggestLinkGroups prompt tuning.
 *
 * Usage: cd backend && npx tsx src/link-group-tests/run-tests.ts
 *
 * Compares AI output (structural grouping) against manually-labeled expected fixtures.
 * Fixtures: src/link-group-tests/fixtures/<name>.input.json + <name>.expected.json
 */
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { suggestLinkGroups, SceneForGrouping, LinkGroupSuggestion } from '../services/vertexAI';

dotenv.config();

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

interface InputFixture {
  short_id: number;
  title: string;
  scenes: SceneForGrouping[];
}

interface FixturePair {
  name: string;
  input: InputFixture;
  expected: LinkGroupSuggestion[];
}

function loadFixtures(): FixturePair[] {
  const files = fs.readdirSync(FIXTURES_DIR);
  const inputFiles = files.filter(f => f.endsWith('.input.json')).sort();

  const pairs: FixturePair[] = [];
  for (const inputFile of inputFiles) {
    const name = inputFile.replace('.input.json', '');
    const expectedFile = name + '.expected.json';
    const expectedPath = path.join(FIXTURES_DIR, expectedFile);
    if (!fs.existsSync(expectedPath)) {
      console.warn(`  [SKIP] No expected file for ${name}`);
      continue;
    }
    const input: InputFixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, inputFile), 'utf-8'));
    const expected: LinkGroupSuggestion[] = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
    pairs.push({ name, input, expected });
  }
  return pairs;
}

/**
 * Compare AI grouping to expected grouping by structure, not by group name.
 *
 * For each expected group: all its scenes must appear in the same AI group.
 * For scenes in different expected groups: they must NOT share an AI group.
 */
function compareGroupings(
  expected: LinkGroupSuggestion[],
  actual: LinkGroupSuggestion[]
): { groupsPassed: number; groupsTotal: number; details: string[] } {
  const details: string[] = [];

  const expectedMap = new Map<number, string>();
  for (const e of expected) expectedMap.set(e.scene_id, e.link_group);

  const actualMap = new Map<number, string>();
  for (const a of actual) actualMap.set(a.scene_id, a.link_group);

  // Build expected groups: name -> set of scene_ids
  const expectedGroups = new Map<string, Set<number>>();
  for (const e of expected) {
    if (!expectedGroups.has(e.link_group)) expectedGroups.set(e.link_group, new Set());
    expectedGroups.get(e.link_group)!.add(e.scene_id);
  }

  let groupsPassed = 0;
  const groupsTotal = expectedGroups.size;

  for (const [groupName, sceneIds] of expectedGroups) {
    const sceneArr = Array.from(sceneIds);

    // Find what AI group each scene is in
    const aiGroupNames = new Set<string>();
    const missingFromAI: number[] = [];
    for (const sceneId of sceneArr) {
      const aiGroup = actualMap.get(sceneId);
      if (!aiGroup) missingFromAI.push(sceneId);
      else aiGroupNames.add(aiGroup);
    }

    if (missingFromAI.length > 0) {
      details.push(`  FAIL [${groupName}]: ${missingFromAI.length}/${sceneArr.length} scenes not grouped (missing: ${missingFromAI.join(', ')})`);
      continue;
    }

    if (aiGroupNames.size > 1) {
      const splitInfo = sceneArr.map(id => `${id}→${actualMap.get(id)}`).join(', ');
      details.push(`  FAIL [${groupName}]: AI split into ${aiGroupNames.size} groups (${splitInfo})`);
      continue;
    }

    // All scenes are in the same AI group — check no cross-contamination
    const aiGroupName = [...aiGroupNames][0];
    const contaminatingScenes = actual
      .filter(a => a.link_group === aiGroupName)
      .map(a => a.scene_id)
      .filter(id => {
        const expGroup = expectedMap.get(id);
        return expGroup !== undefined && expGroup !== groupName;
      });

    if (contaminatingScenes.length > 0) {
      details.push(`  FAIL [${groupName}]: AI merged with scenes from other expected groups: ${contaminatingScenes.join(', ')}`);
      continue;
    }

    details.push(`  PASS [${groupName}]: all ${sceneArr.length} scenes correctly grouped as '${aiGroupName}'`);
    groupsPassed++;
  }

  // Check for unexpected AI groups containing scenes that should be ungrouped
  const ungroupedSceneIds = new Set(
    [...new Set(expected.concat(actual).map(x => x.scene_id))]
      .filter(id => !expectedMap.has(id))
  );
  const falsePositives = actual.filter(a => ungroupedSceneIds.has(a.scene_id));
  if (falsePositives.length > 0) {
    const fpList = falsePositives.map(a => `${a.scene_id}→'${a.link_group}'`).join(', ');
    details.push(`  WARN: AI grouped ${falsePositives.length} scenes that should be ungrouped: ${fpList}`);
  }

  return { groupsPassed, groupsTotal, details };
}

async function runTests() {
  const filterArg = process.argv[2]; // e.g. "81,90,94"
  let fixtures = loadFixtures();
  if (filterArg) {
    const ids = filterArg.split(',').map(s => s.trim());
    fixtures = fixtures.filter(f => ids.some(id => f.name.includes(id)));
  }
  if (fixtures.length === 0) {
    console.error('No fixture pairs found in', FIXTURES_DIR);
    process.exit(1);
  }

  console.log(`\nRunning link-group tests against ${fixtures.length} fixtures...\n`);
  console.log('='.repeat(70));

  let totalGroupsPassed = 0;
  let totalGroupsTotal = 0;
  let fixturesPassed = 0;

  for (const fixture of fixtures) {
    console.log(`\n[${fixture.name}] — "${fixture.input.title}"`);
    console.log(`  Scenes: ${fixture.input.scenes.length}, Expected groups: ${new Set(fixture.expected.map(e => e.link_group)).size}`);

    let actual: LinkGroupSuggestion[];
    try {
      actual = await suggestLinkGroups(fixture.input.scenes);
    } catch (err: any) {
      console.error(`  ERROR calling suggestLinkGroups: ${err.message}`);
      continue;
    }

    console.log(`  AI returned ${actual.length} grouped scenes across ${new Set(actual.map(a => a.link_group)).size} groups`);

    const { groupsPassed, groupsTotal, details } = compareGroupings(fixture.expected, actual);

    for (const line of details) console.log(line);

    const fixturePass = groupsPassed === groupsTotal;
    console.log(`  Result: ${groupsPassed}/${groupsTotal} groups matched${fixturePass ? ' ✓' : ' ✗'}`);

    totalGroupsPassed += groupsPassed;
    totalGroupsTotal += groupsTotal;
    if (fixturePass) fixturesPassed++;
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\nFinal: ${fixturesPassed}/${fixtures.length} fixtures fully passed`);
  console.log(`Groups: ${totalGroupsPassed}/${totalGroupsTotal} expected groups correctly identified`);
  console.log('');

  process.exit(fixturesPassed === fixtures.length ? 0 : 1);
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
