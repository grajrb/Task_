import { v4 as uuidv4 } from 'uuid';
import * as cheerio from 'cheerio';

class IngestionService {
  constructor(sqliteStore, vectorStore, embeddingService) {
    this.sqliteStore = sqliteStore;
    this.vectorStore = vectorStore;
    this.embeddingService = embeddingService;
    
    // Chunking configuration - aggressive limits for memory safety
    this.chunkSize = 50; // tokens (~200 chars)
    this.chunkOverlap = 0; // NO overlap to reduce memory
    this.maxChunksPerItem = 1; // SINGLE chunk only
    this.maxContentLength = 500; // 500 chars per item
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
      // Fetch URL with aggressive size limit using streaming
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AIKnowledgeInbox/1.0)'
        }
      });
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Read response in chunks with strict size limit
      const maxSize = 50000; // 50KB max HTML
      let htmlChunks = [];
      let totalSize = 0;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          totalSize += value.length;
          if (totalSize > maxSize) {
            console.log(`[IngestionService] Stopping download at ${totalSize} bytes (limit: ${maxSize})`);
            reader.cancel();
            break;
          }
          
          htmlChunks.push(decoder.decode(value, { stream: true }));
        }
      } finally {
        reader.releaseLock();
      }
      
      let html = htmlChunks.join('');
      htmlChunks = null; // Free memory immediately
      
      if (html.length === 0) {
        throw new Error('No content received from URL');
      }
      
      console.log(`[IngestionService] Downloaded ${html.length} bytes from ${url}`);
      
      // Extract text with minimal memory usage - handle incomplete HTML
      let $ = cheerio.load(html, { 
        xmlMode: false,
        decodeEntities: false,
        normalizeWhitespace: true
      });
      html = null; // Free memory immediately
      
      // Remove unwanted elements first
      $('script, style, nav, footer, header, aside, iframe, noscript, .sidebar, #sidebar, .navigation, .ad, .advertisement, .menu, #menu').remove();
      
      // Extract all text content from the entire document
      let text = $.text();
      $ = null; // Free cheerio instance
      
      // Clean up whitespace aggressively
      text = text.replace(/\s+/g, ' ').trim();
      
      console.log(`[IngestionService] Extracted ${text.length} characters of text`);
      
      if (!text || text.length < 20) {
        throw new Error(`Insufficient text content extracted from URL (got ${text.length} chars). Try a smaller or simpler page.`);
      }
      
      // Limit text size ultra-aggressively for short notes
      const maxTextSize = 500; // 500 chars max
      if (text.length > maxTextSize) {
        console.log(`[IngestionService] Content truncated from ${text.length} to ${maxTextSize} characters`);
        text = text.substring(0, maxTextSize);
      }
      
      // Store raw item
      this.sqliteStore.insertItem(itemId, 'url', text, {
        ...metadata,
        url,
        characterCount: text.length,
        title: url
      });
      
      // Chunk and store (no embeddings)
      await this.processContent(itemId, text);
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
        console.log(`[IngestionService] Garbage collection triggered`);
      }
      
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
    try {
      // Enforce content length limit
      let content = text;
      if (text.length > this.maxContentLength) {
        content = text.substring(0, this.maxContentLength);
        console.log(`[IngestionService] Content truncated from ${text.length} to ${this.maxContentLength} characters`);
      }
      
      // Chunk the text
      const chunks = this.chunkText(content);
      
      // Enforce max chunks limit
      if (chunks.length > this.maxChunksPerItem) {
        console.log(`[IngestionService] Limiting chunks from ${chunks.length} to ${this.maxChunksPerItem}`);
        chunks.splice(this.maxChunksPerItem);
      }
      
      console.log(`[IngestionService] Created ${chunks.length} chunks`);
      
      // Store chunks without embeddings (defer to query time)
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `${itemId}_chunk_${i}`;
        
        try {
          // Store chunk without embedding (null embeddingId)
          this.sqliteStore.insertChunk(chunkId, itemId, chunks[i], i, null);
        } catch (error) {
          console.warn(`[IngestionService] Error storing chunk ${i}:`, error.message);
        }
      }
      console.log(`[IngestionService] Completed processing ${chunks.length} chunks (embeddings deferred to query time)`);
      
      console.log(`[IngestionService] Completed processing ${chunks.length} chunks`);
      
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      console.error(`[IngestionService] Error in processContent:`, error.message);
      throw error;
    }
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
      
      if (end < text.length) {
        const lastPeriod = chunk.lastIndexOf('.');
        const lastNewline = chunk.lastIndexOf('\n');
        const breakPoint = Math.max(lastPeriod, lastNewline);
        
        if (breakPoint > charsPerChunk * 0.5) {
          chunk = chunk.slice(0, breakPoint + 1);
        }
      }
      
      chunks.push(chunk.trim());
      start += chunk.length - overlapChars;
      
      if (start <= chunks[chunks.length - 1].length) {
        start = chunks[chunks.length - 1].length + overlapChars;
      }
    }
    
    return chunks.filter(c => c.length > 0);
  }

}

export default IngestionService;
