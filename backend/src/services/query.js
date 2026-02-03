import OpenAI from 'openai';

class QueryService {
  constructor(sqliteStore, vectorStore, embeddingService, apiKey, model = 'gpt-4o-mini') {
    this.sqliteStore = sqliteStore;
    this.vectorStore = vectorStore;
    this.embeddingService = embeddingService;
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  /**
   * Query the knowledge base using RAG
   */
  async query(question, topK = 5) {
    console.log(`[QueryService] Processing query: "${question}"`);
    
    // 1. Generate embedding for the question
    const questionEmbedding = await this.embeddingService.generateEmbedding(question);
    
    // 2. Search vector store for similar chunks
    const vectorResults = this.vectorStore.search(questionEmbedding, topK);
    
    if (vectorResults.length === 0) {
      return {
        answer: "I don't have any relevant information to answer that question. Please add some content first.",
        sources: [],
        confidence: 0
      };
    }
    
    // 3. Retrieve chunk details from SQLite
    const chunkIds = vectorResults.map(r => r.chunkId);
    const chunks = this.sqliteStore.getChunksByIds(chunkIds);
    
    // Merge vector results with chunk details
    const enrichedChunks = chunks.map(chunk => {
      const vectorResult = vectorResults.find(vr => vr.chunkId === chunk.id);
      return {
        ...chunk,
        similarity: vectorResult?.similarity || 0
      };
    });
    
    // 4. Build context from top chunks
    const context = enrichedChunks
      .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
      .join('\n\n');
    
    console.log(`[QueryService] Retrieved ${enrichedChunks.length} relevant chunks`);
    
    // 5. Generate answer using LLM
    const answer = await this.generateAnswer(question, context);
    
    // 6. Format sources for response
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
  }

  /**
   * Generate answer using OpenAI with retrieved context
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
        max_tokens: 1000
      });

      console.log('[QueryService] Generated answer from LLM');
      return response.choices[0].message.content;
      
    } catch (error) {
      console.error('[QueryService] Error generating answer:', error.message);
      throw new Error(`Failed to generate answer: ${error.message}`);
    }
  }
}

export default QueryService;
