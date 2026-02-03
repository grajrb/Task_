import { GoogleGenerativeAI } from '@google/generative-ai';

class EmbeddingService {
  constructor(apiKey, model = 'text-embedding-004') {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async generateEmbedding(text) {
    try {
      const embeddingModel = this.client.getGenerativeModel({ model: this.model });
      const result = await embeddingModel.embedContent(text);

      console.log(`[EmbeddingService] Generated embedding for text (${text.length} chars)`);
      return result.embedding.values;
    } catch (error) {
      console.error('[EmbeddingService] Error generating embedding:', error.message);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  async generateEmbeddings(texts) {
    try {
      const embeddingModel = this.client.getGenerativeModel({ model: this.model });
      
      // Generate embeddings sequentially (Gemini doesn't support batch)
      const embeddings = [];
      for (const text of texts) {
        const result = await embeddingModel.embedContent(text);
        embeddings.push(result.embedding.values);
      }

      console.log(`[EmbeddingService] Generated ${texts.length} embeddings`);
      return embeddings;
    } catch (error) {
      console.error('[EmbeddingService] Error generating embeddings:', error.message);
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
  }
}

export default EmbeddingService;
