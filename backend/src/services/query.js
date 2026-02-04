import OpenAI from 'openai';

class QueryService {
  constructor(sqliteStore, vectorStore, embeddingService, apiKey, model = 'gpt-4o-mini', baseURL = null) {
    this.sqliteStore = sqliteStore;
    this.vectorStore = vectorStore;
    this.embeddingService = embeddingService;
    
    const config = { apiKey };
    if (baseURL) {
      config.baseURL = baseURL;
    }
    this.client = new OpenAI(config);
    this.model = model;
    this.baseURL = baseURL;
    
    console.log(`[QueryService] Initialized with model: ${model}`);
    if (baseURL) {
      console.log(`[QueryService] Using base URL: ${baseURL}`);
    }
  }

  /**
   * Query the knowledge base using keyword search (text-based, no embeddings)
   */
  async query(question, topK = 5) {
    console.log(`[QueryService] Processing query: "${question}"`);
    
    // Use text-based keyword search (embeddings disabled for memory management)
    const keywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    console.log(`[QueryService] Searching with keywords: ${keywords.join(', ')}`);
    
    // Get all chunks and score by keyword matches
    const allChunks = this.sqliteStore.getAllChunks();
    const scoredChunks = allChunks.map(chunk => {
      const content = chunk.content.toLowerCase();
      const matches = keywords.reduce((sum, keyword) => {
        return sum + (content.split(keyword).length - 1);
      }, 0);
      return { ...chunk, score: matches };
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
    
    if (scoredChunks.length === 0) {
      return {
        answer: "I don't have any relevant information to answer that question. Please add some content first.",
        sources: [],
        confidence: 0
      };
    }
    
    // 4. Build context from top chunks
    const context = scoredChunks
      .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
      .join('\n\n');
    
    console.log(`[QueryService] Retrieved ${scoredChunks.length} relevant chunks`);
    
    // 5. Generate answer using LLM
    const answer = await this.generateAnswer(question, context);
    
    // 6. Format sources for response
    const sources = scoredChunks.map((chunk, i) => ({
      index: i + 1,
      content: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
      itemId: chunk.itemId,
      itemType: chunk.itemType,
      score: chunk.score,
      metadata: chunk.itemMetadata
    }));
    
    return {
      answer,
      sources,
      confidence: Math.min(1, scoredChunks[0]?.score / 10 || 0)
    };
  }

  /**
   * Generate answer using OpenAI LLM with retrieved context
   */
  async generateAnswer(question, context) {
    const systemPrompt = `You are a helpful assistant that answers questions based on the provided context.

Instructions:
- Answer the question using ONLY the information from the provided context
- If the context doesn't contain relevant information, say so clearly
- Cite sources by referencing the [number] in the context
- Be concise but complete
- If you're uncertain, indicate that in your response`;

    const userPrompt = `Context from knowledge base:
${context}

Question: ${question}

Please provide a clear answer based on the context above.`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      console.log('[QueryService] Generated answer from OpenAI');
      return response.choices[0].message.content;
      
    } catch (error) {
      console.error('[QueryService] Error generating answer:', error.message);
      throw new Error(`Failed to generate answer: ${error.message}`);
    }
  }
}

export default QueryService;
