import OpenAI from 'openai';

class EmbeddingService {
  constructor(apiKey, model = 'text-embedding-3-small') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generateEmbedding(text) {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
      });

      console.log(`[EmbeddingService] Generated embedding for text (${text.length} chars)`);
      return response.data[0].embedding;
    } catch (error) {
      console.error('[EmbeddingService] Error generating embedding:', error.message);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  async generateEmbeddings(texts) {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: texts,
      });

      console.log(`[EmbeddingService] Generated ${texts.length} embeddings`);
      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('[EmbeddingService] Error generating embeddings:', error.message);
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
  }
}

export default EmbeddingService;
