import OpenAI from 'openai';

class EmbeddingService {
  constructor(apiKey, model = 'text-embedding-3-small', baseURL = null) {
    const config = { apiKey };
    if (baseURL) {
      config.baseURL = baseURL;
    }
    this.client = new OpenAI(config);
    this.model = model;
    this.baseURL = baseURL;
    
    console.log(`[EmbeddingService] Initialized with model: ${model}`);
    if (baseURL) {
      console.log(`[EmbeddingService] Using base URL: ${baseURL}`);
    }
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
    // Generate one at a time to avoid memory issues
    const embeddings = [];
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }
    
    console.log(`[EmbeddingService] Generated ${texts.length} embeddings`);
    return embeddings;
  }
}

export default EmbeddingService;
