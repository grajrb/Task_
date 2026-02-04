import express from 'express';
import { ValidationError } from '../middleware/logger.js';

const router = express.Router();

/**
 * POST /ingest
 * Ingest text content or URL
 */
export const createIngestRoute = (ingestionService) => {
  router.post('/ingest', async (req, res, next) => {
    try {
      const { type, content, url, metadata } = req.body;
      
      // Validation
      if (!type || !['text', 'url'].includes(type)) {
        throw new ValidationError('Type must be either "text" or "url"');
      }
      
      if (type === 'text') {
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
          throw new ValidationError('Content is required and must be a non-empty string');
        }
        
        if (content.length > 500) {
          throw new ValidationError('Content too large (max 500 characters for short notes)');
        }
        
        const itemId = await ingestionService.ingestText(content, metadata || {});
        
        res.status(201).json({
          success: true,
          itemId,
          type: 'text',
          message: 'Text content ingested successfully'
        });
        
      } else if (type === 'url') {
        throw new ValidationError('URL ingestion is not supported. Please use text input only (max 500 characters).');
      }
      
    } catch (error) {
      next(error);
    }
  });
  
  return router;
};
