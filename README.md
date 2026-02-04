# AI Knowledge Inbox

A production-style web application that enables users to save notes and URLs, then query their content using Retrieval-Augmented Generation (RAG). Features semantic search with persistent SQLite storage and configurable multi-provider AI support.

## Features

- ✅ **Content Ingestion**: Save text notes (max 500 chars) or fetch content from URLs
- ✅ **Semantic Search**: Vector-based similarity search using embeddings (text-embedding-3-small)
- ✅ **RAG Pipeline**: Answer questions using retrieved context with configurable LLM
- ✅ **Source Citations**: View relevant chunks with similarity scores
- ✅ **Persistent Storage**: SQLite database with automatic schema initialization
- ✅ **Lazy Embeddings**: Embeddings generated on-demand during queries (no ingestion slowdown)
- ✅ **Memory Safe**: Aggressive chunking limits prevent heap crashes
- ✅ **Clean Architecture**: Separated concerns across services, routes, and components

## Tech Stack

**Backend:**
- Node.js 22 with --max-old-space-size=1024 --expose-gc
- Express.js 4.18.2
- better-sqlite3 (persistent data storage)
- OpenAI SDK v4.20.1 (multi-provider compatible)
- Cheerio (intelligent HTML extraction)
- text-embedding-3-small (1536 dimensions)

**AI Providers (Configurable):**
- ✅ OpenRouter (default: mistralai/mistral-7b-instruct)
- ✅ OpenAI (gpt-4o-mini)

**Frontend:**
- React 18.2.0 with hooks
- Vite 5.0.8 (dev server & bundler)
- CSS for styling

## Prerequisites

- Node.js 22+
- OpenRouter API key (or alternative provider key)
  - OpenRouter: https://openrouter.ai (FREE tier available)
  - OpenAI: https://openai.com

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/grajrb/Task_.git
cd Task_

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment

```bash
# In project root, create .env file
cp .env.example .env

# Edit .env and add your API key
# For OpenRouter (recommended):
API_KEY=your-openrouter-key
API_BASE_URL=https://openrouter.ai/api/v1
MODEL=mistralai/mistral-7b-instruct

# Or other providers (see .env.example for all options)
```

### 3. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm start
# Backend runs on http://localhost:3001
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Frontend runs on http://localhost:3000
```

### 4. Use the Application

1. Open http://localhost:3000
2. Add content:
   - Text notes (max 500 characters)
   - URLs (fetched server-side, intelligently extracted)
3. Ask questions about your saved content
4. View AI-generated answers with source citations and similarity scores

## API Endpoints

### POST /api/ingest
Ingest text content or URL
```json
{
  "type": "text",
  "content": "Your text here (max 500 chars)",
  "metadata": {}
}
```
or
```json
{
  "type": "url",
  "url": "https://example.com/article",
  "metadata": {}
}
```

**Response (201):**
```json
{
  "success": true,
  "itemId": "uuid",
  "type": "text|url",
  "message": "Content ingested successfully"
}
```

### GET /api/items
List all saved items

**Response (200):**
```json
{
  "success": true,
  "items": [
    {
      "id": "uuid",
      "type": "text|url",
      "content": "...",
      "metadata": { "url": "...", "characterCount": 200 },
      "createdAt": 1707000000000
    }
  ]
}
```

### POST /api/query
Query the knowledge base with RAG
```json
{
  "question": "What is the main topic?"
}
```

**Response (200):**
```json
{
  "success": true,
  "question": "What is the main topic?",
  "answer": "The main topic is...",
  "sources": [
    {
      "index": 1,
      "content": "...",
      "itemId": "uuid",
      "itemType": "text|url",
      "similarity": 0.87,
      "metadata": { "url": "..." }
    }
  ],
  "confidence": 0.87
}
```

### GET /health
Health check endpoint

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-02-04T10:00:00Z"
}
```

## Architecture & Design Decisions

### Chunking Strategy
- **Approach**: Single fixed-size chunk per document (50 tokens), no overlap
- **Content Limit**: 500 characters per item (text) or URL (after extraction)
- **Rationale**: Prevents memory spikes during ingestion; lazy embeddings mean no computational pressure
- **Trade-off**: Loss of context continuity; acceptable for knowledge inbox use case
- **Scale Limitation**: Works well for 100-1000 items; would need enhancement for 10K+

### Vector Storage
- **Current**: In-memory cosine similarity + SQLite metadata
- **Embedding Model**: text-embedding-3-small (1536 dimensions)
- **Rationale**: Fast, simple, zero external dependencies; SQLite provides persistence
- **Trade-off**: Loses embeddings on restart (recalculated on first query)
- **Production Path**: Migrate to Pinecone, Weaviate, or pgvector for:
  - Persistent vector storage
  - Horizontal scaling
  - Advanced filtering & similarity thresholds

### Lazy Embedding Generation
- **Approach**: Embeddings generated on-demand during queries, not during ingestion
- **Rationale**: Eliminates memory pressure during content collection; fast ingestion (200-300ms)
- **Trade-off**: First query slower (~5-10s for embedding generation), subsequent queries fast
- **Benefit**: Prevents heap crashes with large content volumes

### Multi-Provider AI Support
- **Current**: OpenRouter (mistralai/mistral-7b-instruct)
- **Configurable**: OpenAI via .env
- **Rationale**: Cost flexibility, avoids lock-in, easy switching
- **Trade-off**: Minor response quality variance between providers

### Error Handling
- Structured logging with request IDs (e.g., [abc123] POST /api/ingest)
- Input validation at route level
- Clear HTTP status codes (201, 200, 400, 500)
- Per-chunk error handling (one failed embedding doesn't crash entire batch)
- Graceful degradation (missing embeddings don't prevent response)

## Production Considerations

### What Breaks at Scale

1. **In-memory vector store** - Embeddings lost on restart
   - Solution: Persist embeddings to SQLite or use vector DB

2. **Single server** - No load balancing or failover
   - Solution: Horizontal scaling with shared database

3. **No rate limiting** - API costs could spike
   - Solution: Redis-backed rate limiter + quota system

4. **No authentication** - Currently single-user
   - Solution: JWT auth with user-scoped data

5. **Memory constraints** - Fixed limits (500 chars, 1 chunk) limit content variety
   - Solution: Increase limits with streaming chunking strategy

6. **No caching** - Repeated queries recalculate embeddings
   - Solution: Cache query embeddings by similarity hash


## Project Structure

```
Task/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   └── sqlite.js              # SQLite persistent storage with schema
│   │   ├── services/
│   │   │   ├── embeddings.js          # OpenAI SDK embeddings wrapper
│   │   │   ├── ingestion.js           # Content processing, chunking, lazy embedding
│   │   │   ├── query.js               # RAG query pipeline with on-demand embedding
│   │   │   └── vectorStore.js         # In-memory cosine similarity search
│   │   ├── routes/
│   │   │   ├── ingest.js              # POST /api/ingest
│   │   │   ├── items.js               # GET /api/items
│   │   │   └── query.js               # POST /api/query
│   │   ├── middleware/
│   │   │   └── logger.js              # Logging, error handling, request IDs
│   │   └── server.js                  # Express app setup & initialization
│   ├── knowledge-inbox.db             # SQLite database (gitignored)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AddContent.jsx         # Text/URL input form with validation
│   │   │   ├── AddContent.css
│   │   │   ├── ItemsList.jsx          # Display saved items with metadata
│   │   │   ├── ItemsList.css
│   │   │   ├── QueryInterface.jsx     # Question input & answer display
│   │   │   └── QueryInterface.css
│   │   ├── App.jsx                    # Main app layout
│   │   ├── App.css
│   │   ├── main.jsx                   # React entry point
│   │   ├── index.css                  # Global styles
│   │   └── index.html
│   └── package.json
├── .env.example                        # Environment template
├── .env                                # Actual config (gitignored)
├── .gitignore
├── README.md
├── IMPLEMENTATION_SUMMARY.md           # Detailed checklist
└── SYSTEM_DESIGN.md                    # Architecture notes
```

## Environment Variables

```bash
# AI Provider Configuration
API_KEY=your-api-key                    # Required: OpenRouter, Perplexity, LaoZhang, or OpenAI key
API_BASE_URL=https://openrouter.ai/api/v1  # Default: OpenRouter
MODEL=mistralai/mistral-7b-instruct     # LLM model to use
EMBEDDING_MODEL=text-embedding-3-small  # Embedding model (must match provider)

# Server Configuration
PORT=3001                               # Backend server port (default: 3001)
TOP_K_RESULTS=3                         # Number of context chunks per query
MAX_TOKENS=500                          # Maximum LLM response length

# Optional: Multi-Provider Examples

# For OpenAI:
# API_BASE_URL=https://api.openai.com/v1
# MODEL=gpt-4o-mini
```

See `.env.example` for complete defaults.

## Development Notes

### Testing the System

**Add text content (500 chars max):**
```bash
curl -X POST http://localhost:3001/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"type":"text","content":"Python was created by Guido van Rossum in 1991"}'
```

**Add URL content:**
```bash
curl -X POST http://localhost:3001/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"type":"url","url":"https://example.com"}'
```

**Query the knowledge base:**
```bash
curl -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{"question":"Who created Python?"}'
```

### Adding New Content Types

1. Update `IngestionService` for custom extraction
2. Add type validation in `/ingest` route
3. Update frontend `AddContent` component

### Memory Management Tips

- Current limits: 500 chars/item, 1 chunk, 50-token chunks
- To increase limits: Update `maxContentLength`, `maxChunksPerItem` in `ingestion.js`
- Monitor heap usage: `--expose-gc` flag enables manual GC calls
- For larger content: Use incremental chunking with overlap

### Debugging

- Check logs for request IDs: `[abc123] POST /api/ingest - 201 (213ms)`
- Health check: `curl http://localhost:3001/health`
- Verify .env has API_KEY set: Check for "Unauthorized" errors
- Check database: `sqlite3 backend/knowledge-inbox.db ".tables"`
- View all items: `curl http://localhost:3001/api/items`

⚠️ **Known Limitations:**
- Max 500 chars per item (prevents memory crashes)
- Single chunk per document (aggressive for safety)
- No persistent vector storage (embeddings recalculated on restart)
- Single-user (no authentication)
- In-memory vector index (limited to ~1000 items practically)

## Performance Metrics

| Operation | Time | Notes |
|-----------|------|-------|
| Text ingestion | 200-300ms | No embeddings during ingest |
| URL ingestion | 200-400ms | Includes streaming fetch + extraction |
| First query | 5-10s | Includes embedding generation for all chunks |
| Subsequent query | 1-2s | Uses cached embeddings |
| Memory per item | ~50KB | Variable based on content size |

## License

MIT. See [LICENSE](LICENSE).

