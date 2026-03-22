import { MinecraftVersion, MinecraftReport } from '../types';

const VERSION_MANIFEST_URL =
  'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
const WIKI_API_BASE = 'https://minecraft.wiki/api.php';

async function fetchWikiChangelog(versionId: string): Promise<string | null> {
  const pageName = `Java Edition ${versionId}`;
  const url = `${WIKI_API_BASE}?action=parse&page=${encodeURIComponent(pageName)}&format=json&prop=wikitext&redirects&origin=*`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data: any = await response.json();
    const wikitext: string | undefined = data.parse?.wikitext?.['*'];
    if (!wikitext) return null;

    // Extract key sections from wikitext
    const sections = [
      'Additions',
      'Changes',
      'Fixes',
      'Technical changes',
      'Experimental',
    ];
    const extracted: string[] = [];

    for (const section of sections) {
      const regex = new RegExp(
        `={2,3}\\s*${section}\\s*={2,3}([\\s\\S]*?)(?=={2,3}|$)`,
        'i'
      );
      const match = wikitext.match(regex);
      if (match) {
        let content = match[1]
          // [[Link|Text]] -> Text, [[Link]] -> Link
          .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')
          // '''bold''' -> bold
          .replace(/'''([^']+)'''/g, '$1')
          // ''italic'' -> italic
          .replace(/''([^']+)''/g, '$1')
          // Remove templates {{...}}
          .replace(/\{\{[^}]+\}\}/g, '')
          // Remove bug tracker references like |306620|
          .replace(/\|\d{4,}\|/g, '')
          // Remove wiki category/section markers like |;prev |;dev
          .replace(/\|;[a-z]+/g, '')
          // Convert wiki list items (* item) to clean lines
          .replace(/^\*+\s*/gm, '- ')
          // Remove <onlyinclude> tags
          .replace(/<\/?onlyinclude>/g, '')
          // Clean up excessive whitespace
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        if (content) {
          extracted.push(`${section}:\n${content}`);
        }
      }
    }

    return extracted.length > 0 ? extracted.join('\n\n') : null;
  } catch (error: any) {
    console.warn(
      `  Could not fetch wiki changelog for ${versionId}: ${error.message}`
    );
    return null;
  }
}

export async function collectMinecraftUpdates(
  since: Date
): Promise<MinecraftReport> {
  console.log('  Fetching Minecraft version manifest...');

  const response = await fetch(VERSION_MANIFEST_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch version manifest: ${response.status}`);
  }

  const manifest: any = await response.json();
  const newVersions: MinecraftVersion[] = [];

  for (const version of manifest.versions) {
    const releaseTime = new Date(version.releaseTime);
    if (releaseTime <= since) break; // Versions are sorted newest-first

    // Only snapshots and releases (skip old_alpha, old_beta)
    if (version.type !== 'snapshot' && version.type !== 'release') continue;

    console.log(
      `  New ${version.type}: ${version.id} (${releaseTime.toISOString().split('T')[0]})`
    );

    const changelog = await fetchWikiChangelog(version.id);

    newVersions.push({
      id: version.id,
      type: version.type,
      releaseTime: version.releaseTime,
      changelog: changelog || undefined,
    });

    // Rate limit wiki requests
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(
    `  Found ${newVersions.length} new Minecraft versions since last report`
  );

  return { newVersions };
}
