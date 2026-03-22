import { Router, Request, Response } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import * as fs from 'fs';
import * as path from 'path';

export const researchRouter = Router();

researchRouter.use(authenticateToken);
researchRouter.use(requireRole('admin'));

const REPORTS_DIR = path.resolve(__dirname, '../../../research-reports');

// GET /api/research/reports — list all reports with ideas status
researchRouter.get('/reports', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(REPORTS_DIR)) {
      return res.json([]);
    }

    const files = fs.readdirSync(REPORTS_DIR)
      .filter(f => f.endsWith('-raw.json'))
      .sort()
      .reverse()
      .map(filename => {
        const date = filename.replace('-raw.json', '');
        const filePath = path.join(REPORTS_DIR, filename);
        const ideasPath = path.join(REPORTS_DIR, `${date}-ideas.json`);
        const stats = fs.statSync(filePath);

        try {
          const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          const hasIdeas = fs.existsSync(ideasPath);
          let ideaCount = 0;
          if (hasIdeas) {
            try {
              const ideas = JSON.parse(fs.readFileSync(ideasPath, 'utf-8'));
              ideaCount = ideas.ideas?.length || 0;
            } catch {}
          }

          return {
            date,
            periodStart: raw.periodStart,
            periodEnd: raw.periodEnd,
            collectedAt: raw.collectedAt,
            hasIdeas,
            ideaCount,
            summary: {
              youtubeChannels: raw.youtube?.length || 0,
              youtubeStandouts: raw.youtube?.reduce((acc: number, ch: any) => acc + (ch.standouts?.length || 0), 0) || 0,
              redditPosts: raw.reddit?.reduce((acc: number, sub: any) => acc + (sub.posts?.length || 0), 0) || 0,
              minecraftVersions: raw.minecraft?.newVersions?.length || 0,
            },
          };
        } catch {
          return { date, size: stats.size, hasIdeas: false, ideaCount: 0 };
        }
      });

    res.json(files);
  } catch (error: any) {
    console.error('Failed to list research reports:', error);
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

// GET /api/research/reports/:date/ideas — get curated ideas
researchRouter.get('/reports/:date/ideas', (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const filePath = path.join(REPORTS_DIR, `${date}-ideas.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'No ideas generated yet. Run Claude Code to analyze the raw data.' });
    }

    const ideas = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(ideas);
  } catch (error: any) {
    console.error('Failed to read ideas:', error);
    res.status(500).json({ error: 'Failed to read ideas' });
  }
});

// GET /api/research/reports/:date/raw — get raw collected data
researchRouter.get('/reports/:date/raw', (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const filePath = path.join(REPORTS_DIR, `${date}-raw.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(raw);
  } catch (error: any) {
    console.error('Failed to read research report:', error);
    res.status(500).json({ error: 'Failed to read report' });
  }
});
