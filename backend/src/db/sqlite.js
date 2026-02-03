import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SQLiteStore {
  constructor(dbPath = join(__dirname, '../../data/knowledge.db')) {
    this.db = new Database(dbPath);
    this.initTables();
  }

  initTables() {
    // Items table: stores raw content and metadata
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    // Chunks table: stores text chunks with embeddings reference
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        content TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        embedding_id INTEGER NOT NULL,
        FOREIGN KEY (item_id) REFERENCES items(id)
      )
    `);

    console.log('[SQLiteStore] Tables initialized');
  }

  insertItem(id, type, content, metadata) {
    const stmt = this.db.prepare(`
      INSERT INTO items (id, type, content, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, type, content, JSON.stringify(metadata), Date.now());
    console.log(`[SQLiteStore] Inserted item ${id}`);
  }

  insertChunk(id, itemId, content, chunkIndex, embeddingId) {
    const stmt = this.db.prepare(`
      INSERT INTO chunks (id, item_id, content, chunk_index, embedding_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, itemId, content, chunkIndex, embeddingId);
  }

  getAllItems() {
    const stmt = this.db.prepare(`
      SELECT id, type, content, metadata, created_at
      FROM items
      ORDER BY created_at DESC
    `);
    
    const rows = stmt.all();
    return rows.map(row => ({
      id: row.id,
      type: row.type,
      content: row.content,
      metadata: JSON.parse(row.metadata),
      createdAt: row.created_at
    }));
  }

  getChunksByIds(chunkIds) {
    if (!chunkIds.length) return [];
    
    const placeholders = chunkIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT c.id, c.item_id, c.content, c.chunk_index, 
             i.type, i.metadata
      FROM chunks c
      JOIN items i ON c.item_id = i.id
      WHERE c.id IN (${placeholders})
    `);
    
    const rows = stmt.all(...chunkIds);
    return rows.map(row => ({
      id: row.id,
      itemId: row.item_id,
      content: row.content,
      chunkIndex: row.chunk_index,
      itemType: row.type,
      itemMetadata: JSON.parse(row.metadata)
    }));
  }

  getItemById(itemId) {
    const stmt = this.db.prepare(`
      SELECT id, type, content, metadata, created_at
      FROM items
      WHERE id = ?
    `);
    
    const row = stmt.get(itemId);
    if (!row) return null;
    
    return {
      id: row.id,
      type: row.type,
      content: row.content,
      metadata: JSON.parse(row.metadata),
      createdAt: row.created_at
    };
  }

  close() {
    this.db.close();
  }
}

export default SQLiteStore;
