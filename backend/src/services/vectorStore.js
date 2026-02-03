import { HierarchicalNSW } from 'hnswlib-node';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class VectorStore {
  constructor(dimensions = 1536, maxElements = 10000) {
    this.dimensions = dimensions;
    this.maxElements = maxElements;
    this.index = new HierarchicalNSW('cosine', dimensions);
    this.index.initIndex(maxElements);
    
    // Map embedding IDs to chunk IDs
    this.embeddingToChunk = new Map();
    this.nextEmbeddingId = 0;
    
    console.log(`[VectorStore] Initialized with ${dimensions} dimensions, max ${maxElements} elements`);
  }

  addEmbedding(chunkId, embedding) {
    if (embedding.length !== this.dimensions) {
      throw new Error(`Embedding dimension mismatch: expected ${this.dimensions}, got ${embedding.length}`);
    }

    const embeddingId = this.nextEmbeddingId++;
    this.index.addPoint(embedding, embeddingId);
    this.embeddingToChunk.set(embeddingId, chunkId);
    
    return embeddingId;
  }

  search(queryEmbedding, k = 5) {
    if (this.nextEmbeddingId === 0) {
      console.log('[VectorStore] No embeddings in index');
      return [];
    }

    if (queryEmbedding.length !== this.dimensions) {
      throw new Error(`Query embedding dimension mismatch: expected ${this.dimensions}, got ${queryEmbedding.length}`);
    }

    const numNeighbors = Math.min(k, this.nextEmbeddingId);
    const result = this.index.searchKnn(queryEmbedding, numNeighbors);
    
    // result.neighbors contains embedding IDs, result.distances contains distances
    const results = [];
    for (let i = 0; i < result.neighbors.length; i++) {
      const embeddingId = result.neighbors[i];
      const chunkId = this.embeddingToChunk.get(embeddingId);
      const distance = result.distances[i];
      const similarity = 1 - distance; // cosine distance to similarity
      
      results.push({
        chunkId,
        similarity,
        distance
      });
    }
    
    console.log(`[VectorStore] Found ${results.length} results for query`);
    return results;
  }

  getSize() {
    return this.nextEmbeddingId;
  }

  // Optional: Save/load index for persistence
  saveIndex(filepath = join(__dirname, '../../data/vector.index')) {
    const dir = dirname(filepath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    this.index.writeIndexSync(filepath);
    console.log(`[VectorStore] Index saved to ${filepath}`);
  }

  loadIndex(filepath = join(__dirname, '../../data/vector.index')) {
    if (!existsSync(filepath)) {
      console.log('[VectorStore] No saved index found');
      return false;
    }
    
    this.index.readIndexSync(filepath);
    console.log(`[VectorStore] Index loaded from ${filepath}`);
    return true;
  }
}

export default VectorStore;
