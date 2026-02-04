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
          throw new ValidationError('Content too large (max 500 characters)');
        }
        
        const itemId = await ingestionService.ingestText(content, metadata || {});
        
        res.status(201).json({
          success: true,
          itemId,
          type: 'text',
          message: 'Text content ingested successfully'
        });
        
      } else if (type === 'url') {
        if (!url || typeof url !== 'string') {
          throw new ValidationError('URL is required and must be a string');
        }
        
        // Basic URL validation
        try {
          new URL(url);
        } catch {
          throw new ValidationError('Invalid URL format');
        }
        
        const itemId = await ingestionService.ingestUrl(url, metadata || {});
        
        res.status(201).json({
          success: true,
          itemId,
          type: 'url',
          url,
          message: 'URL content ingested successfully'
        });
      }
      
    } catch (error) {
      next(error);
    }
  });
  
  return router;
};
