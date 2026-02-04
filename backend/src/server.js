import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

import SQLiteStore from './db/sqlite.js';
import VectorStore from './services/vectorStore.js';
import EmbeddingService from './services/embeddings.js';
import IngestionService from './services/ingestion.js';
import QueryService from './services/query.js';

import { createIngestRoute } from './routes/ingest.js';
import { createItemsRoute } from './routes/items.js';
import { createQueryRoute } from './routes/query.js';

import { requestLogger, errorHandler } from './middleware/logger.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || process.env.OPENAI_API_KEY || process.env.PERPLEXITY_API_KEY;
const API_BASE_URL = process.env.API_BASE_URL || null; // e.g., https://api.laozhang.ai/v1 or https://openrouter.ai/api/v1
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = parseInt(process.env.EMBEDDING_DIMENSIONS || '1536');
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const TOP_K_RESULTS = parseInt(process.env.TOP_K_RESULTS || '5');

// Validate configuration
if (!API_KEY) {
  console.error('ERROR: API_KEY is not set in environment variables');
  console.error('Please create a .env file based on .env.example');
  console.error('\nSupported providers:');
  console.error('  - Perplexity: https://www.perplexity.ai/settings/api');
  console.error('  - OpenRouter: https://openrouter.ai/keys');
  console.error('  - LaoZhang AI: https://api.laozhang.ai/');
  console.error('  - OpenAI: https://platform.openai.com/api-keys');
  process.exit(1);
}

// Ensure data directory exists
const dataDir = join(__dirname, '../data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Initialize services
console.log('[Server] Initializing services...');
const sqliteStore = new SQLiteStore();
const vectorStore = new VectorStore(EMBEDDING_DIMENSIONS);
const embeddingService = null; // Not used with Gemini + keyword search
const ingestionService = new IngestionService(sqliteStore, vectorStore, null);
const queryService = new QueryService(sqliteStore, vectorStore, null, API_KEY, LLM_MODEL, API_BASE_URL);

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    vectorStoreSize: vectorStore.getSize(),
    config: {
      embeddingModel: EMBEDDING_MODEL,
      llmModel: LLM_MODEL,
      topK: TOP_K_RESULTS
    }
  });
});

// API routes
app.use('/api', createIngestRoute(ingestionService));
app.use('/api', createItemsRoute(sqliteStore));
app.use('/api', createQueryRoute(queryService));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      path: req.path
    }
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`[Server] AI Knowledge Inbox API running on port ${PORT}`);
  console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  if (API_BASE_URL) {
    console.log(`[Server] Using custom API endpoint: ${API_BASE_URL}`);
  } else {
    console.log(`[Server] Using default OpenAI API`);
  }
  console.log(`[Server] Embedding model: ${EMBEDDING_MODEL}`);
  console.log(`[Server] LLM model: ${LLM_MODEL}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  sqliteStore.close();
  process.exit(0);
});
