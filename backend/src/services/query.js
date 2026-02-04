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
   * Query the knowledge base with lazy embedding generation
   */
  async query(question, topK = 5) {
    console.log(`[QueryService] Processing query: "${question}"`);
    
    try {
      // 1. Get all chunks from database
      const allChunks = this.sqliteStore.getAllChunks();
      
      if (allChunks.length === 0) {
        return {
          answer: "I don't have any relevant information to answer that question. Please add some content first.",
          sources: [],
          confidence: 0
        };
      }
      
      // 2. Generate embeddings for all chunks (first time only, cached in vectorStore)
      console.log(`[QueryService] Generating embeddings for ${allChunks.length} chunks...`);
      for (const chunk of allChunks) {
        if (!this.vectorStore.hasEmbedding(chunk.id)) {
          try {
            const embedding = await this.embeddingService.generateEmbedding(chunk.content);
            this.vectorStore.addEmbedding(chunk.id, embedding);
          } catch (err) {
            console.warn(`[QueryService] Failed to embed chunk ${chunk.id}:`, err.message);
          }
        }
      }
      
      // 3. Generate embedding for question and search
      console.log(`[QueryService] Generating question embedding...`);
      const questionEmbedding = await this.embeddingService.generateEmbedding(question);
      const vectorResults = this.vectorStore.search(questionEmbedding, topK);
      
      if (vectorResults.length === 0) {
        return {
          answer: "I don't have any relevant information to answer that question. Try different keywords.",
          sources: [],
          confidence: 0
        };
      }
      
      // 4. Retrieve chunk details
      const chunkIds = vectorResults.map(r => r.chunkId);
      const chunks = this.sqliteStore.getChunksByIds(chunkIds);
      
      const enrichedChunks = chunks.map(chunk => {
        const vectorResult = vectorResults.find(vr => vr.chunkId === chunk.id);
        return { ...chunk, similarity: vectorResult?.similarity || 0 };
      });
      
      // 4. Build context
      const context = enrichedChunks
        .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
        .join('\n\n');
      
      console.log(`[QueryService] Retrieved ${enrichedChunks.length} relevant chunks`);
      
      // 5. Generate answer
      const answer = await this.generateAnswer(question, context);
      
      // 6. Format sources
      const sources = enrichedChunks.map((chunk, i) => ({
        index: i + 1,
        content: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
        itemId: chunk.itemId,
        itemType: chunk.itemType,
        similarity: chunk.similarity,
        metadata: chunk.itemMetadata
      }));
      
      return {
        answer,
        sources,
        confidence: enrichedChunks[0]?.similarity || 0
      };
    } catch (error) {
      console.error('[QueryService] Error in query:', error.message);
      throw error;
    }
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
