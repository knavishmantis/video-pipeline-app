import { Router, Request, Response } from 'express';
import { shortsController } from '../controllers/shorts';
import { authenticateToken, requireRole } from '../middleware/auth';
import { requireProfileComplete } from '../middleware/profileCheck';
import { validate } from '../middleware/validate';
import { createShortSchema, updateShortSchema } from '../validators/shorts';
import { query } from '../db';

export const shortsRouter = Router();

shortsRouter.use(authenticateToken);
shortsRouter.use(requireProfileComplete);

shortsRouter.get('/', shortsController.getAll);
shortsRouter.get('/assigned', shortsController.getAssigned);
shortsRouter.get('/reflection-stats', shortsController.getReflectionStats);
shortsRouter.get('/:id', shortsController.getById);
shortsRouter.post('/', validate(createShortSchema), shortsController.create);
shortsRouter.put('/:id', validate(updateShortSchema), shortsController.update);
shortsRouter.delete('/:id', shortsController.delete);
shortsRouter.patch('/:id/toggle-active', requireRole('admin'), shortsController.toggleActive);
shortsRouter.patch('/:id/script-sub-stage', requireRole('admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { script_sub_stage } = req.body;
  const valid = ['idea', 'written', 'scenes', null];
  if (!valid.includes(script_sub_stage)) {
    res.status(400).json({ error: 'Invalid script_sub_stage value' });
    return;
  }
  try {
    const result = await query(
      `UPDATE shorts SET script_sub_stage = $1, updated_at = NOW() WHERE id = $2 RETURNING id, script_sub_stage`,
      [script_sub_stage, id]
    );
    if (!result.rows.length) { res.status(404).json({ error: 'Short not found' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update script sub stage' });
  }
});
shortsRouter.post('/:id/mark-clips-complete', requireRole('admin'), shortsController.markClipsComplete);
shortsRouter.post('/:id/mark-editing-complete', requireRole('admin'), shortsController.markEditingComplete);

// POST /api/shorts/:id/analyze-script — AI script quality analysis via Gemini
shortsRouter.post('/:id/analyze-script', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT script_content, title FROM shorts WHERE id = $1', [req.params.id]);
    if (!result.rows.length) { res.status(404).json({ error: 'Short not found' }); return; }
    const script: string = result.rows[0].script_content ?? '';
    if (!script.trim()) { res.status(400).json({ error: 'Short has no script content' }); return; }

    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    if (!accessToken.token) throw new Error('Failed to get access token');

    const PROJECT_ID = process.env.GCP_PROJECT_ID;
    const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const endpoint = `https://us-central1-aiplatform.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/us-central1/publishers/google/models/${MODEL}:generateContent`;

    const prompt = `You are a script quality reviewer for KnavishMantis, a Minecraft YouTube Shorts channel. Analyze the script below and return ONLY a JSON object.

CHANNEL CONTEXT:
- 60-90 second Minecraft YouTube Shorts, 150-300 words
- Voice: comedic, opinionated, slightly unhinged Minecraft commentary
- Structure: Provocative hook → BUT/THEREFORE chain of reveals → Twist/punchline ending
- Every story beat must connect with BUT/SO/THEREFORE — never AND THEN
- Content is in-game Minecraft mechanics, history, or takes — not abstract topics

CHECKS TO PERFORM (only flag real issues — don't manufacture problems):

1. AND Transitions [error]: Are story beats connected with "And" sequentially instead of BUT/THEREFORE pivots? Don't just look for literal "And" at sentence start — catch the spirit: if beats connect as "and then... and then..." with no tension or consequence between them, flag it. Quote the specific transitions.

2. Listicle Format [error]: Does the script announce a count of items upfront? ("there are 3 types", "Top 5", implied "First... Second... Third..." structure). This kills curiosity by telling the viewer the shape of what's coming. Quote the tell.

3. Outline Preview [error]: Does the script preview its structure before delivering it? ("In this video I'll explain...", "Today we'll look at X then Y"). Signals the viewer can mentally skip ahead. Quote the tell.

4. Fluff Lines [error]: Any engagement bait, channel plugs, or sentences that waste air time? ("let me know in the comments", "hit subscribe", "I don't know about you but"). Also flag phrases that add zero information — pure filler that delays value. Quote each one.

5. Hedge Words [warning]: Author uncertainty that weakens authority — "maybe", "might", "could", "probably", "I think", "I guess". IMPORTANT: Do NOT flag these when describing actual Minecraft game mechanics probabilities (e.g. "a skeleton might drop a bow" is mechanics, not hedging). Only flag when the writer is being uncertain about their own claims or analysis. Quote the specific phrases.

6. Contrast Density [warning]: Does the script rely on narrative tension throughout, or do sections read as a flat sequence of facts? Look specifically at the middle section — are there enough BUT/ACTUALLY/TURNS OUT pivots to keep pulling the viewer forward, or does it plateau into a list? Only flag if there are clear flat stretches, not just because the count is low.

7. $100/word [warning]: Every word must earn its place. Flag specific sentences or phrases that add nothing and could be cut without losing meaning: setup that restates the hook, filler transitions ("So basically...", "What I mean is..."), obvious facts the viewer already knows, anything that delays getting to the interesting content. Quote the expendable text.

Return ONLY this JSON (no markdown, no code fences, no explanation outside the JSON):
{
  "issues": [
    {
      "type": "error|warning|info",
      "check": "check name",
      "message": "specific 1-2 sentence explanation of the problem",
      "matches": ["exact short quote from the script — under 80 chars each"]
    }
  ]
}

Rules:
- Only include a check if there is a genuine issue. If a check passes, omit it entirely.
- "matches" must be exact quotes from the script, not paraphrases.
- If the script is fully clean, return: {"issues": []}

SCRIPT TO ANALYZE:
${script}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json' },
      }),
    });
    if (!response.ok) { const e = await response.text(); res.status(500).json({ error: `Gemini error: ${e.substring(0, 200)}` }); return; }
    const data = await response.json() as any;
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    // Extract the JSON object even if Gemini wraps it in markdown fences or extra text
    const clean = text.trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object found in Gemini response');
    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (e: any) {
    console.error('[analyze-script] error:', e);
    res.status(500).json({ error: e.message || e.toString() || 'Unknown error' });
  }
});

