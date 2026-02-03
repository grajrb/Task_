import { v4 as uuidv4 } from 'uuid';
import * as cheerio from 'cheerio';

class IngestionService {
  constructor(sqliteStore, vectorStore, embeddingService) {
    this.sqliteStore = sqliteStore;
    this.vectorStore = vectorStore;
    this.embeddingService = embeddingService;
    
    // Chunking configuration
    this.chunkSize = 500; // tokens (roughly 2000 chars)
    this.chunkOverlap = 100; // tokens overlap
  }

  /**
   * Ingest text content
   */
  async ingestText(text, metadata = {}) {
    const itemId = uuidv4();
    
    console.log(`[IngestionService] Ingesting text item ${itemId}`);
    
    // Store raw item
    this.sqliteStore.insertItem(itemId, 'text', text, {
      ...metadata,
      characterCount: text.length
    });
    
    // Chunk and embed
    await this.processContent(itemId, text);
    
    return itemId;
  }

  /**
   * Ingest URL content
   */
  async ingestUrl(url, metadata = {}) {
    const itemId = uuidv4();
    
    console.log(`[IngestionService] Fetching content from ${url}`);
    
    try {
      // Fetch URL content
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extract text content (remove scripts, styles, etc.)
      $('script, style, nav, footer, header').remove();
      const text = $('body').text().trim().replace(/\s+/g, ' ');
      
      if (!text || text.length < 50) {
        throw new Error('Insufficient text content extracted from URL');
      }
      
      // Store raw item
      this.sqliteStore.insertItem(itemId, 'url', text, {
        ...metadata,
        url,
        characterCount: text.length,
        title: $('title').text().trim() || url
      });
      
      // Chunk and embed
      await this.processContent(itemId, text);
      
      console.log(`[IngestionService] Successfully ingested URL ${url} (${text.length} chars)`);
      return itemId;
      
    } catch (error) {
      console.error(`[IngestionService] Error fetching URL ${url}:`, error.message);
      throw new Error(`Failed to fetch URL: ${error.message}`);
    }
  }

  /**
   * Process content: chunk, embed, and store
   */
  async processContent(itemId, text) {
    // Simple chunking strategy: split by approximate token count
    // Rough estimate: 1 token ≈ 4 characters
    const chunks = this.chunkText(text);
    
    console.log(`[IngestionService] Created ${chunks.length} chunks for item ${itemId}`);
    
    // Generate embeddings for all chunks
    const embeddings = await this.embeddingService.generateEmbeddings(chunks);
    
    // Store chunks and embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunkId = `${itemId}_chunk_${i}`;
      const embedding = embeddings[i];
      
      // Add to vector store
      const embeddingId = this.vectorStore.addEmbedding(chunkId, embedding);
      
      // Store chunk in SQLite
      this.sqliteStore.insertChunk(chunkId, itemId, chunks[i], i, embeddingId);
    }
    
    console.log(`[IngestionService] Processed ${chunks.length} chunks for item ${itemId}`);
  }

  /**
   * Simple fixed-size chunking with overlap
   */
  chunkText(text) {
    const charsPerChunk = this.chunkSize * 4; // ~4 chars per token
    const overlapChars = this.chunkOverlap * 4;
    
    const chunks = [];
    let start = 0;
    
    while (start < text.length) {
      const end = Math.min(start + charsPerChunk, text.length);
      let chunk = text.slice(start, end);
      
      // Try to break at sentence boundaries for better chunks
      if (end < text.length) {
        const lastPeriod = chunk.lastIndexOf('.');
        const lastNewline = chunk.lastIndexOf('\n');
        const breakPoint = Math.max(lastPeriod, lastNewline);
        
        if (breakPoint > charsPerChunk * 0.5) {
          chunk = chunk.slice(0, breakPoint + 1);
        }
      }
      
      chunks.push(chunk.trim());
      
      // Move start forward, accounting for overlap
      start += chunk.length - overlapChars;
      
      // Ensure we make progress
      if (start <= chunks[chunks.length - 1].length) {
        start = chunks[chunks.length - 1].length + overlapChars;
      }
    }
    
    return chunks.filter(c => c.length > 0);
  }
}

export default IngestionService;
