import express from 'express';

const router = express.Router();

/**
 * GET /items
 * Get all saved items
 */
export const createItemsRoute = (sqliteStore) => {
  router.get('/items', async (req, res, next) => {
    try {
      const items = sqliteStore.getAllItems();
      
      // Format response
      const formattedItems = items.map(item => ({
        id: item.id,
        type: item.type,
        preview: item.content.substring(0, 200) + (item.content.length > 200 ? '...' : ''),
        metadata: item.metadata,
        createdAt: new Date(item.createdAt).toISOString()
      }));
      
      res.json({
        success: true,
        count: formattedItems.length,
        items: formattedItems
      });
      
    } catch (error) {
      next(error);
    }
  });
  
  /**
   * GET /items/:id
   * Get a specific item by ID
   */
  router.get('/items/:id', async (req, res, next) => {
    try {
      const { id } = req.params;
      const item = sqliteStore.getItemById(id);
      
      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Item not found'
        });
      }
      
      res.json({
        success: true,
        item: {
          id: item.id,
          type: item.type,
          content: item.content,
          metadata: item.metadata,
          createdAt: new Date(item.createdAt).toISOString()
        }
      });
      
    } catch (error) {
      next(error);
    }
  });
  
  return router;
};
