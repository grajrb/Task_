/**
 * SQLite persistent data store
 * Uses better-sqlite3 for synchronous database operations
 */
import Database from 'better-sqlite3';
import path from 'path';

class SQLiteStore {
  constructor() {
    // Create database in project root
    const dbPath = path.resolve('./knowledge-inbox.db');
    this.db = new Database(dbPath);
    
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
    
    // Create tables if they don't exist
    this.initializeTables();
    
    console.log('[SQLiteStore] Initialized SQLite database at ' + dbPath);
  }

  initializeTables() {
    // Items table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT,
        metadata TEXT,
        createdAt INTEGER NOT NULL
      );
    `);

    // Chunks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        itemId TEXT NOT NULL,
        content TEXT NOT NULL,
        chunkIndex INTEGER NOT NULL,
        embeddingId TEXT,
        FOREIGN KEY (itemId) REFERENCES items(id) ON DELETE CASCADE
      );
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chunks_itemId ON chunks(itemId);
    `);
  }

  insertItem(id, type, content, metadata) {
    const stmt = this.db.prepare(`
      INSERT INTO items (id, type, content, metadata, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const metadataJson = metadata ? JSON.stringify(metadata) : null;
    stmt.run(id, type, content, metadataJson, Date.now());
    
    console.log(`[SQLiteStore] Inserted item ${id}`);
  }

  insertChunk(id, itemId, content, chunkIndex, embeddingId) {
    const stmt = this.db.prepare(`
      INSERT INTO chunks (id, itemId, content, chunkIndex, embeddingId)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, itemId, content, chunkIndex, embeddingId || null);
  }

  getAllItems() {
    const stmt = this.db.prepare(`
      SELECT * FROM items
      ORDER BY createdAt DESC
    `);
    
    const items = stmt.all();
    
    // Parse metadata back to object
    return items.map(item => ({
      ...item,
      metadata: item.metadata ? JSON.parse(item.metadata) : null
    }));
  }

  getChunksByIds(chunkIds) {
    if (!chunkIds.length) return [];
    
    // Create placeholders for IN clause
    const placeholders = chunkIds.map(() => '?').join(',');
    
    const stmt = this.db.prepare(`
      SELECT 
        c.id,
        c.itemId,
        c.content,
        c.chunkIndex,
        c.embeddingId,
        i.type as itemType,
        i.metadata
      FROM chunks c
      JOIN items i ON c.itemId = i.id
      WHERE c.id IN (${placeholders})
    `);
    
    const chunks = stmt.all(...chunkIds);
    
    // Parse metadata back to object
    return chunks.map(chunk => ({
      ...chunk,
      itemMetadata: chunk.metadata ? JSON.parse(chunk.metadata) : null,
      metadata: undefined
    }));
  }

  getAllChunks() {
    const stmt = this.db.prepare(`
      SELECT 
        c.id,
        c.itemId,
        c.content,
        c.chunkIndex,
        c.embeddingId,
        i.type as itemType,
        i.metadata
      FROM chunks c
      JOIN items i ON c.itemId = i.id
      ORDER BY c.itemId, c.chunkIndex ASC
    `);
    
    const chunks = stmt.all();
    
    // Parse metadata back to object
    return chunks.map(chunk => ({
      ...chunk,
      itemMetadata: chunk.metadata ? JSON.parse(chunk.metadata) : null,
      metadata: undefined
    }));
  }

  getItemById(itemId) {
    const stmt = this.db.prepare(`
      SELECT * FROM items WHERE id = ?
    `);
    
    const item = stmt.get(itemId);
    if (!item) return null;
    
    return {
      ...item,
      metadata: item.metadata ? JSON.parse(item.metadata) : null
    };
  }

  close() {
    if (this.db) {
      this.db.close();
      console.log('[SQLiteStore] Database closed');
    }
  }
}

export default SQLiteStore;
