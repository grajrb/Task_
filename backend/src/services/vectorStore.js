/**
 * Simple in-memory vector store using cosine similarity
 * Pure JavaScript implementation - no native dependencies required
 */
class VectorStore {
  constructor(dimensions = 768) {
    this.dimensions = dimensions;
    this.vectors = []; // Array of { id, chunkId, embedding }
    
    console.log(`[VectorStore] Initialized with ${dimensions} dimensions`);
  }

  addEmbedding(chunkId, embedding) {
    if (embedding.length !== this.dimensions) {
      throw new Error(`Embedding dimension mismatch: expected ${this.dimensions}, got ${embedding.length}`);
    }

    const embeddingId = this.vectors.length;
    this.vectors.push({
      id: embeddingId,
      chunkId,
      embedding
    });
    
    return embeddingId;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  search(queryEmbedding, k = 5) {
    if (this.vectors.length === 0) {
      console.log('[VectorStore] No embeddings in index');
      return [];
    }

    if (queryEmbedding.length !== this.dimensions) {
      throw new Error(`Query embedding dimension mismatch: expected ${this.dimensions}, got ${queryEmbedding.length}`);
    }

    // Calculate similarity for all vectors
    const similarities = this.vectors.map(vec => ({
      chunkId: vec.chunkId,
      similarity: this.cosineSimilarity(queryEmbedding, vec.embedding)
    }));
    
    // Sort by similarity (descending) and take top k
    similarities.sort((a, b) => b.similarity - a.similarity);
    const results = similarities.slice(0, k);
    
    console.log(`[VectorStore] Found ${results.length} results for query`);
    return results;
  }

  getSize() {
    return this.vectors.length;
  }
}

export default VectorStore;
