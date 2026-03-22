import { Router, Request, Response } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import * as fs from 'fs';
import * as path from 'path';

export const researchRouter = Router();

researchRouter.use(authenticateToken);
researchRouter.use(requireRole('admin'));

const REPORTS_DIR = path.resolve(__dirname, '../../../research-reports');
const BACKLOG_PATH = path.join(REPORTS_DIR, 'backlog.json');

function readBacklog(): any {
  if (!fs.existsSync(BACKLOG_PATH)) {
    return { ideas: [], lastUpdated: null };
  }
  return JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf-8'));
}

function writeBacklog(data: any): void {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(BACKLOG_PATH, JSON.stringify(data, null, 2));
}

// GET /api/research/ideas — get all ideas from the backlog
researchRouter.get('/ideas', (_req: Request, res: Response) => {
  try {
    const backlog = readBacklog();
    res.json(backlog);
  } catch (error: any) {
    console.error('Failed to read backlog:', error);
    res.status(500).json({ error: 'Failed to read ideas' });
  }
});

// POST /api/research/ideas/:ideaId/acknowledge — toggle acknowledged
researchRouter.post('/ideas/:ideaId/acknowledge', (req: Request, res: Response) => {
  try {
    const { ideaId } = req.params;
    const backlog = readBacklog();
    const idea = backlog.ideas?.find((i: any) => i.ideaId === ideaId);
    if (!idea) {
      return res.status(404).json({ error: 'Idea not found' });
    }

    idea.acknowledged = !idea.acknowledged;
    writeBacklog(backlog);
    res.json({ ideaId, acknowledged: idea.acknowledged });
  } catch (error: any) {
    console.error('Failed to acknowledge idea:', error);
    res.status(500).json({ error: 'Failed to acknowledge idea' });
  }
});
