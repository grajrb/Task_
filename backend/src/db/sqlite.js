/**
 * Simple in-memory data store
 * No external dependencies - pure JavaScript
 */
class SQLiteStore {
  constructor() {
    this.items = new Map(); // id -> item
    this.chunks = new Map(); // chunkId -> chunk
    
    console.log('[SQLiteStore] Initialized in-memory store');
  }

  insertItem(id, type, content, metadata) {
    this.items.set(id, {
      id,
      type,
      content,
      metadata,
      createdAt: Date.now()
    });
    
    console.log(`[SQLiteStore] Inserted item ${id}`);
  }

  insertChunk(id, itemId, content, chunkIndex, embeddingId) {
    this.chunks.set(id, {
      id,
      itemId,
      content,
      chunkIndex,
      embeddingId
    });
  }

  getAllItems() {
    const items = Array.from(this.items.values());
    // Sort by created date descending
    items.sort((a, b) => b.createdAt - a.createdAt);
    return items;
  }

  getChunksByIds(chunkIds) {
    if (!chunkIds.length) return [];
    
    return chunkIds.map(chunkId => {
      const chunk = this.chunks.get(chunkId);
      if (!chunk) return null;
      
      const item = this.items.get(chunk.itemId);
      if (!item) return null;
      
      return {
        id: chunk.id,
        itemId: chunk.itemId,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        itemType: item.type,
        itemMetadata: item.metadata
      };
    }).filter(Boolean);
  }

  getItemById(itemId) {
    return this.items.get(itemId) || null;
  }

  close() {
    // No-op for in-memory store
  }
}

export default SQLiteStore;
