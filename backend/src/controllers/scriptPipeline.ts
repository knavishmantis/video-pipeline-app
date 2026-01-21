import { Response } from 'express';
import { query } from '../db';
import { AuthRequest } from '../middleware/auth';
import { Short, CreateScriptPipelineInput, UpdateScriptDraftInput, AdvanceStageInput } from '../../../shared/types';
import { logger } from '../utils/logger';

// Validation rules (same for all stages)
const VALIDATION_RULES = [
  'Does the hook create genuine interest',
  'Does the first few seconds scream "this is high quality"',
  'Did I do enough research?',
  'Are all facts accurate?',
  'Does this have genuine viral potential?',
  'Will people feel inclined to subscribe?',
  'Is it 6th grade reading level or below?',
  'Is there a double hook (reason to keep watching)?',
  'Is the pacing good (is it all interesting)',
];

function getRulesForStage(stage: 'first_draft' | 'second_draft' | 'final_draft'): string[] {
  // Same rules for all stages
  return VALIDATION_RULES;
}

export const scriptPipelineController = {
  // Get all shorts in the script pipeline (view-only, all users)
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { stage } = req.query;
      
      let sqlQuery = `
        SELECT s.*
        FROM shorts s
        WHERE s.script_draft_stage IS NOT NULL
      `;
      const params: any[] = [];
      
      if (stage) {
        sqlQuery += ` AND s.script_draft_stage = $${params.length + 1}`;
        params.push(stage);
      }
      
      sqlQuery += ' ORDER BY s.created_at DESC';
      
      const result = await query(sqlQuery, params);
      res.json(result.rows);
    } catch (error) {
      logger.error('Get script pipeline shorts error', { error });
      res.status(500).json({ error: 'Failed to fetch script pipeline shorts' });
    }
  },

  // Get specific short's draft content (view-only, all users)
  async getDraft(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const result = await query(
        `SELECT s.*
         FROM shorts s
         WHERE s.id = $1 AND s.script_draft_stage IS NOT NULL`,
        [id]
      );
      
      if (result.rows.length === 0) {
        res.status(404).json({ error: 'Short not found in script pipeline' });
        return;
      }
      
      const short = result.rows[0];
      
      // Get validation rules for current stage
      const currentStage = short.script_draft_stage;
      const rules = currentStage ? getRulesForStage(currentStage) : [];
      
      res.json({
        ...short,
        validation_rules: rules,
      });
    } catch (error) {
      logger.error('Get script draft error', { error });
      res.status(500).json({ error: 'Failed to fetch script draft' });
    }
  },

  // Create new short in script pipeline (admin/script_writer only)
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { title, description, idea } = req.body as CreateScriptPipelineInput;
      
      if (!title || !title.trim()) {
        res.status(400).json({ error: 'Title is required' });
        return;
      }
      
      const result = await query(
        `INSERT INTO shorts (title, description, idea, script_draft_stage, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'first_draft', 'idea', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [title.trim(), description?.trim() || null, idea?.trim() || null]
      );
      
      const short = result.rows[0];
      res.status(201).json(short);
    } catch (error) {
      logger.error('Create script pipeline short error', { error });
      res.status(500).json({ error: 'Failed to create short in script pipeline' });
    }
  },

  // Update draft content and notes (admin/script_writer only)
  async updateDraft(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { draft_text, stage, notes } = req.body as UpdateScriptDraftInput;
      
      if (!stage || !['first_draft', 'second_draft', 'final_draft'].includes(stage)) {
        res.status(400).json({ error: 'Invalid stage' });
        return;
      }
      
      // Check if short exists and is in pipeline
      const checkResult = await query(
        `SELECT script_draft_stage FROM shorts WHERE id = $1`,
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        res.status(404).json({ error: 'Short not found' });
        return;
      }
      
      const currentStage = checkResult.rows[0].script_draft_stage;
      if (!currentStage) {
        res.status(400).json({ error: 'Short is not in script pipeline' });
        return;
      }
      
      // Build update query based on stage
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;
      
      if (draft_text !== undefined) {
        if (stage === 'first_draft') {
          updates.push(`script_first_draft = $${paramIndex++}`);
          params.push(draft_text);
        } else if (stage === 'second_draft') {
          updates.push(`script_second_draft = $${paramIndex++}`);
          params.push(draft_text);
        } else if (stage === 'final_draft') {
          updates.push(`script_final_draft = $${paramIndex++}`);
          params.push(draft_text);
        }
      }
      
      if (notes !== undefined) {
        updates.push(`script_pipeline_notes = $${paramIndex++}`);
        params.push(notes);
      }
      
      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }
      
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);
      
      await query(
        `UPDATE shorts 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}`,
        params
      );
      
      // Fetch updated short
      const result = await query(
        `SELECT * FROM shorts WHERE id = $1`,
        [id]
      );
      
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Update script draft error', { error });
      res.status(500).json({ error: 'Failed to update script draft' });
    }
  },

  // Update description (admin/script_writer only)
  async updateDescription(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { description } = req.body as { description?: string };
      
      // Check if short exists and is in pipeline
      const checkResult = await query(
        `SELECT script_draft_stage FROM shorts WHERE id = $1`,
        [id]
      );
      
      if (checkResult.rows.length === 0) {
        res.status(404).json({ error: 'Short not found' });
        return;
      }
      
      const currentStage = checkResult.rows[0].script_draft_stage;
      if (!currentStage) {
        res.status(400).json({ error: 'Short is not in script pipeline' });
        return;
      }
      
      await query(
        `UPDATE shorts 
         SET description = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [description?.trim() || null, id]
      );
      
      // Fetch updated short
      const result = await query(
        `SELECT * FROM shorts WHERE id = $1`,
        [id]
      );
      
      res.json(result.rows[0]);
    } catch (error) {
      logger.error('Update description error', { error });
      res.status(500).json({ error: 'Failed to update description' });
    }
  },

  // Advance to next stage (admin/script_writer only)
  async advanceStage(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { validated_rules } = req.body as AdvanceStageInput;
      
      // Get current short
      const shortResult = await query(
        `SELECT * FROM shorts WHERE id = $1`,
        [id]
      );
      
      if (shortResult.rows.length === 0) {
        res.status(404).json({ error: 'Short not found' });
        return;
      }
      
      const short = shortResult.rows[0];
      const currentStage = short.script_draft_stage;
      
      if (!currentStage) {
        res.status(400).json({ error: 'Short is not in script pipeline' });
        return;
      }
      
      // Get required rules for current stage
      const requiredRules = getRulesForStage(currentStage);
      
      // Validate all rules are checked
      if (!validated_rules || validated_rules.length < requiredRules.length) {
        res.status(400).json({ 
          error: 'All validation rules must be checked before advancing',
          required_rules: requiredRules,
        });
        return;
      }
      
      // Determine next stage
      let nextStage: 'second_draft' | 'final_draft' | null = null;
      let completionField: string | null = null;
      
      if (currentStage === 'first_draft') {
        nextStage = 'second_draft';
        completionField = 'first_draft_completed_at';
      } else if (currentStage === 'second_draft') {
        nextStage = 'final_draft';
        completionField = 'second_draft_completed_at';
      } else if (currentStage === 'final_draft') {
        // Final stage - mark as completed and create in kanban
        completionField = 'final_draft_completed_at';
      }
      
      // Build update query
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;
      
      if (nextStage) {
        // Copy current draft to next stage
        if (currentStage === 'first_draft') {
          updates.push(`script_second_draft = script_first_draft`);
        } else if (currentStage === 'second_draft') {
          updates.push(`script_final_draft = script_second_draft`);
        }
        
        updates.push(`script_draft_stage = $${paramIndex++}`);
        params.push(nextStage);
      } else if (currentStage === 'final_draft') {
        // Final stage completed - create in kanban
        updates.push(`script_content = script_final_draft`);
        updates.push(`status = $${paramIndex++}`);
        params.push('script');
        updates.push(`script_draft_stage = NULL`); // Clear draft stage so it appears in kanban
      }
      
      // Set completion timestamp
      if (completionField) {
        updates.push(`${completionField} = CURRENT_TIMESTAMP`);
      }
      
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);
      
      await query(
        `UPDATE shorts 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}`,
        params
      );
      
      // Fetch updated short
      const result = await query(
        `SELECT * FROM shorts WHERE id = $1`,
        [id]
      );
      
      const updatedShort = result.rows[0];
      
      // If final draft completed, return success message
      if (currentStage === 'final_draft') {
        res.json({
          ...updatedShort,
          message: 'Script pipeline completed! Short has been added to kanban dashboard.',
        });
      } else {
        res.json(updatedShort);
      }
    } catch (error) {
      logger.error('Advance script stage error', { error });
      res.status(500).json({ error: 'Failed to advance script stage' });
    }
  },
};

