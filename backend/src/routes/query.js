import express from 'express';
import { ValidationError } from '../middleware/logger.js';

const router = express.Router();

/**
 * POST /query
 * Query the knowledge base
 */
export const createQueryRoute = (queryService) => {
  router.post('/query', async (req, res, next) => {
    try {
      const { question, topK } = req.body;
      
      // Validation
      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        throw new ValidationError('Question is required and must be a non-empty string');
      }
      
      if (question.length > 1000) {
        throw new ValidationError('Question too long (max 1,000 characters)');
      }
      
      const k = topK && typeof topK === 'number' ? topK : 5;
      
      if (k < 1 || k > 20) {
        throw new ValidationError('topK must be between 1 and 20');
      }
      
      // Execute query
      const result = await queryService.query(question, k);
      
      res.json({
        success: true,
        question,
        answer: result.answer,
        sources: result.sources,
        confidence: result.confidence
      });
      
    } catch (error) {
      next(error);
    }
  });
  
  return router;
};
