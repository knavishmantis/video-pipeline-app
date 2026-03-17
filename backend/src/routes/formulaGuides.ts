import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';

const FORMULA_PAT = process.env.FORMULA_REPO_PAT;
const OWNER = 'KnavishMantis';

const REPOS: Record<string, string> = {
  flashback: 'flashback-formula',
  editing: 'editing-formula',
};

// Rewrite relative image paths (e.g. docs/images/foo.png) to our proxy endpoint
function rewriteRelativeImages(markdown: string, type: string): string {
  const proxyBase = `/api/formula-guides/${type}`;
  // HTML src="docs/images/..." → proxy endpoint
  let result = markdown.replace(
    /src="docs\/images\/([^"]+)"/g,
    `src="${proxyBase}/images/$1"`
  );
  // Markdown ![alt](docs/images/...) → proxy endpoint
  result = result.replace(
    /\]\(docs\/images\/([^)]+)\)/g,
    `](${proxyBase}/images/$1)`
  );
  return result;
}

async function fetchLastCommitDate(repo: string): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'video-pipeline-app',
  };
  if (FORMULA_PAT) {
    headers.Authorization = `Bearer ${FORMULA_PAT}`;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${repo}/commits?path=README.md&per_page=1`, { headers });
    if (!res.ok) return null;
    const commits = (await res.json()) as Array<{ commit: { committer: { date: string } } }>;
    return commits[0]?.commit?.committer?.date || null;
  } catch {
    return null;
  }
}

async function fetchReadme(type: string): Promise<{ markdown: string; lastUpdated: string | null }> {
  const repo = REPOS[type];
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'video-pipeline-app',
  };
  if (FORMULA_PAT) {
    headers.Authorization = `Bearer ${FORMULA_PAT}`;
  }

  const [readmeRes, lastUpdated] = await Promise.all([
    fetch(`https://api.github.com/repos/${OWNER}/${repo}/readme`, { headers }),
    fetchLastCommitDate(repo),
  ]);

  if (!readmeRes.ok) {
    throw new Error(`GitHub API returned ${readmeRes.status}: ${await readmeRes.text()}`);
  }
  const data = (await readmeRes.json()) as { content: string };
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return { markdown: rewriteRelativeImages(content, type), lastUpdated };
}

// Proxy for raw images stored in docs/images/ in the formula repos (private repo needs auth)
async function proxyImage(repo: string, imagePath: string): Promise<{ buffer: Buffer; contentType: string }> {
  const headers: Record<string, string> = {
    'User-Agent': 'video-pipeline-app',
  };
  if (FORMULA_PAT) {
    headers.Authorization = `Bearer ${FORMULA_PAT}`;
  }

  // Fetch via the GitHub Contents API to get the download_url
  const apiRes = await fetch(`https://api.github.com/repos/${OWNER}/${repo}/contents/${imagePath}`, { headers });
  if (!apiRes.ok) {
    throw new Error(`GitHub API returned ${apiRes.status}`);
  }
  const data = (await apiRes.json()) as { download_url?: string };
  const downloadUrl = data.download_url;
  if (!downloadUrl) {
    throw new Error('No download URL available');
  }

  const imgHeaders: Record<string, string> = { 'User-Agent': 'video-pipeline-app' };
  if (FORMULA_PAT) {
    imgHeaders.Authorization = `token ${FORMULA_PAT}`;
  }
  const imgRes = await fetch(downloadUrl, { headers: imgHeaders });
  if (!imgRes.ok) {
    throw new Error(`Image download returned ${imgRes.status}`);
  }
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const contentType = imgRes.headers.get('content-type') || 'image/png';
  return { buffer, contentType };
}

export const formulaGuidesRouter = Router();

// Image proxy is unauthenticated — browsers can't send JWT in <img> tags
// GET /api/formula-guides/:type/images/*  (proxy for repo images)
formulaGuidesRouter.get('/:type/images/*', async (req: Request, res: Response) => {
  const { type } = req.params;
  const repo = REPOS[type];
  if (!repo) {
    return res.status(400).json({ error: 'Invalid guide type.' });
  }

  const imagePath = (req.params as any)[0];
  if (!imagePath) {
    return res.status(400).json({ error: 'Missing image path' });
  }

  try {
    const { buffer, contentType } = await proxyImage(repo, `docs/images/${imagePath}`);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err: any) {
    console.error(`Failed to proxy image ${imagePath}:`, err.message);
    res.status(502).json({ error: 'Failed to fetch image from GitHub' });
  }
});

// Markdown endpoints require auth
formulaGuidesRouter.use(authenticateToken);

// GET /api/formula-guides/:type  (type = "flashback" | "editing")
formulaGuidesRouter.get('/:type', async (req: Request, res: Response) => {
  const { type } = req.params;
  const repo = REPOS[type];
  if (!repo) {
    return res.status(400).json({ error: 'Invalid guide type. Use "flashback" or "editing".' });
  }

  try {
    const { markdown, lastUpdated } = await fetchReadme(type);
    res.json({ markdown, lastUpdated });
  } catch (err: any) {
    console.error(`Failed to fetch ${type} formula:`, err.message);
    res.status(502).json({ error: 'Failed to fetch guide from GitHub' });
  }
});

