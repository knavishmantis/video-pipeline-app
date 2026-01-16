import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { gradeScript } from '../services/vertexAI';
import { logger } from '../utils/logger';
import { query } from '../db';

// Lazy import pdf-parse to avoid startup issues
// Wrapper function for pdf-parse v2.x class-based API
async function pdfParse(buffer: Buffer): Promise<{ text: string }> {
  // Dynamic import to avoid loading pdf-parse at module initialization
  // This prevents startup crashes in Cloud Run
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return { text: result.text || '' };
}

export const scriptGradingController = {
  async gradeScript(req: AuthRequest, res: Response): Promise<void> {
    try {
      let scriptText: string;
      const { shortId } = req.body;
      
      // Check if PDF file was uploaded
      const pdfFile = (req as any).file;
      if (pdfFile) {
        // Validate PDF file
        if (!pdfFile.buffer || pdfFile.buffer.length === 0) {
          logger.error('PDF file is empty or invalid', { 
            pdfMimeType: pdfFile?.mimetype,
            pdfOriginalName: pdfFile?.originalname 
          });
          res.status(400).json({ error: 'PDF file is empty or invalid' });
          return;
        }

        if (pdfFile.mimetype && !pdfFile.mimetype.includes('pdf')) {
          logger.warn('File may not be a PDF', { 
            mimetype: pdfFile.mimetype,
            originalName: pdfFile.originalname 
          });
        }

        // Extract text from PDF
        try {
          const pdfBuffer = pdfFile.buffer;
          const pdfData = await pdfParse(pdfBuffer);
          scriptText = pdfData.text;
          logger.info('Extracted text from PDF', { 
            userId: req.userId, 
            pdfSize: pdfBuffer.length,
            extractedTextLength: scriptText.length 
          });
        } catch (pdfError: any) {
          const errorMessage = pdfError?.message || String(pdfError) || 'Unknown error';
          const errorStack = pdfError?.stack || 'No stack trace';
          const errorName = pdfError?.name || 'Error';
          
          logger.error('Failed to parse PDF', { 
            error: errorMessage,
            errorName,
            errorStack,
            pdfSize: pdfFile?.buffer?.length,
            pdfMimeType: pdfFile?.mimetype,
            pdfOriginalName: pdfFile?.originalname
          });
          res.status(400).json({ 
            error: 'Failed to extract text from PDF',
            details: errorMessage || 'Invalid PDF file'
          });
          return;
        }
      } else {
        // Use text from request body
        scriptText = req.body.scriptText;
      }

      if (!scriptText || typeof scriptText !== 'string' || !scriptText.trim()) {
        res.status(400).json({ error: 'Script text is required' });
        return;
      }

      if (scriptText.length > 50000) {
        res.status(400).json({ error: 'Script text is too long (max 50,000 characters)' });
        return;
      }

      logger.info('Grading script', { userId: req.userId, scriptLength: scriptText.length });

      // Grade the script using Vertex AI
      const jsonResponse = await gradeScript(scriptText);

      // Parse and validate JSON response
      let gradingResult;
      try {
        gradingResult = JSON.parse(jsonResponse);
      } catch (parseError) {
        // Log more of the response for debugging (first 2000 chars)
        logger.error('Failed to parse JSON response from Gemini', { 
          error: parseError, 
          responseLength: jsonResponse.length,
          responsePreview: jsonResponse.substring(0, 2000),
          responseEnd: jsonResponse.length > 2000 ? jsonResponse.substring(jsonResponse.length - 500) : ''
        });
        res.status(500).json({ 
          error: 'Invalid response format from AI service',
          details: 'The AI service returned invalid JSON. Please try again.'
        });
        return;
      }

      // Validate response structure
      if (!gradingResult.total_score || !gradingResult.categories || !Array.isArray(gradingResult.categories)) {
        logger.error('Invalid response structure from Gemini', { gradingResult });
        res.status(500).json({ 
          error: 'Invalid response structure from AI service',
          details: 'The AI service did not return the expected grading format.'
        });
        return;
      }

      // If shortId is provided, save the rating to the short
      if (shortId && gradingResult.rating !== undefined) {
        try {
          await query(
            'UPDATE shorts SET script_rating = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [gradingResult.rating, shortId]
          );
          logger.info('Script rating saved to short', { shortId, rating: gradingResult.rating });
        } catch (dbError) {
          logger.error('Failed to save script rating to short', { shortId, error: dbError });
          // Don't fail the request if saving rating fails, just log it
        }
      }

      res.json(gradingResult);
    } catch (error: any) {
      const errorMessage = error?.message || String(error) || 'Unknown error';
      const errorStack = error?.stack || 'No stack trace';
      const errorName = error?.name || 'Error';
      
      logger.error('Grade script error', { 
        error: errorMessage,
        errorName,
        errorStack: errorStack.substring(0, 1000), // Limit stack trace size
        userId: req.userId,
      });
      
      if (errorMessage?.includes('access token')) {
        res.status(500).json({ 
          error: 'Authentication failed',
          details: 'Failed to authenticate with AI service. Please check service account permissions.'
        });
        return;
      }

      if (errorMessage?.includes('Vertex AI API error') || errorMessage?.includes('Vertex AI')) {
        res.status(500).json({ 
          error: 'AI service error',
          details: errorMessage
        });
        return;
      }

      if (errorMessage?.includes('grading criteria')) {
        res.status(500).json({ 
          error: 'Configuration error',
          details: 'Failed to load grading criteria. Please contact support.'
        });
        return;
      }

      res.status(500).json({ 
        error: 'Failed to grade script',
        details: errorMessage || 'An unexpected error occurred'
      });
    }
  },
};

