import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { collectYouTubeData } from './collectors/youtube';
import { collectRedditData } from './collectors/reddit';
import { collectMinecraftUpdates } from './collectors/minecraft';
import { config } from './config';
import { CollectedData } from './types';

// Load env files. dotenv.config() without args loads from CWD (backend/.env).
// Also load scripts/.env which has YOUTUBE_API_KEY.
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../scripts/.env'), override: true });

const STATE_FILE = path.join(__dirname, '.last-report');
const REPORTS_DIR = path.join(__dirname, '../../../research-reports');

function getLastReportDate(): Date {
  try {
    const timestamp = fs.readFileSync(STATE_FILE, 'utf-8').trim();
    return new Date(timestamp);
  } catch {
    // First run: default lookback
    const d = new Date();
    d.setDate(d.getDate() - config.defaultLookbackDays);
    return d;
  }
}

function saveLastReportDate(date: Date): void {
  fs.writeFileSync(STATE_FILE, date.toISOString());
}

async function fetchOwnChannelData(): Promise<{
  recentShorts: { title: string; views: number | null }[];
  avgViews: number;
}> {
  // TODO: Query youtube_video_analytics table from the DB
  return { recentShorts: [], avgViews: 0 };
}

async function main() {
  const since = getLastReportDate();
  const now = new Date();
  const periodStart = since.toISOString().split('T')[0];
  const periodEnd = now.toISOString().split('T')[0];

  console.log(`\n=== Research Report Generator ===`);
  console.log(`Period: ${periodStart} to ${periodEnd}\n`);

  // Collect from all sources
  console.log('[1/4] YouTube competitors');
  const youtube = await collectYouTubeData(since);

  console.log('\n[2/4] Reddit trends');
  const reddit = await collectRedditData(since);

  console.log('\n[3/4] Minecraft updates');
  const minecraft = await collectMinecraftUpdates(since);

  console.log('\n[4/4] Own channel analytics');
  const ownChannel = await fetchOwnChannelData();

  const collectedData: CollectedData = {
    youtube,
    reddit,
    minecraft,
    ownChannel,
    collectedAt: now.toISOString(),
    periodStart,
    periodEnd,
  };

  // Ensure reports directory exists
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  // Save raw data
  const dateStr = periodEnd;
  const rawDataPath = path.join(REPORTS_DIR, `${dateStr}-raw.json`);
  fs.writeFileSync(rawDataPath, JSON.stringify(collectedData, null, 2));
  console.log(`\nRaw data saved to ${rawDataPath}`);

  // Update state
  saveLastReportDate(now);
  console.log('Last report date updated. Next run will cover from ' + periodEnd);
  console.log('\nTo generate an AI report, run Claude Code and ask it to read:');
  console.log(`  ${rawDataPath}`);
}

main().catch((error) => {
  console.error('Research report failed:', error);
  process.exit(1);
});
