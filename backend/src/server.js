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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-004';
const EMBEDDING_DIMENSIONS = parseInt(process.env.EMBEDDING_DIMENSIONS || '768');
const LLM_MODEL = process.env.LLM_MODEL || 'gemini-1.5-flash';
const TOP_K_RESULTS = parseInt(process.env.TOP_K_RESULTS || '5');

// Validate configuration
if (!GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY is not set in environment variables');
  console.error('Please create a .env file based on .env.example');
  console.error('Get your API key from: https://aistudio.google.com/app/apikey');
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
const embeddingService = new EmbeddingService(GEMINI_API_KEY, EMBEDDING_MODEL);
const ingestionService = new IngestionService(sqliteStore, vectorStore, embeddingService);
const queryService = new QueryService(sqliteStore, vectorStore, embeddingService, GEMINI_API_KEY, LLM_MODEL);

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
  console.log(`[Server] Using Google Gemini API`);
  console.log(`[Server] Embedding model: ${EMBEDDING_MODEL}`);
  console.log(`[Server] LLM model: ${LLM_MODEL}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  sqliteStore.close();
  process.exit(0);
});
