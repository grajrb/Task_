# AI Knowledge Inbox

A production-style web application that enables users to save notes and URLs, then query their content using Retrieval-Augmented Generation (RAG) with OpenAI's API.

## Features

- **Content Ingestion**: Save text notes or fetch content from URLs
- **Semantic Search**: Vector-based similarity search using embeddings
- **RAG Pipeline**: Answer questions using retrieved context with GPT-4o-mini
- **Source Citations**: View relevant chunks with similarity scores
- **Clean Architecture**: Separated concerns across services, routes, and components

## Tech Stack

**Backend:**
- Node.js + Express
- Google Gemini API (embeddings + LLM)
- In-memory data storage (JavaScript Maps)
- In-memory vector search (cosine similarity)
- Cheerio (URL content extraction)

**Frontend:**
- React 18 with hooks
- Vite (dev server & bundler)
- CSS modules for styling

## Prerequisites

- Node.js 18+ 
- Google Gemini API key ([Get one here](https://aistudio.google.com/app/apikey)) - **FREE tier available!**

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd Task

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment

```bash
# In project root, copy the example env file
cp .env.example .env

# Edit .env and add your Gemini API key
# Get free key at: https://aistudio.google.com/app/apikey
# GEMINI_API_KEY=your-key-here
```

See [GEMINI_SETUP.md](GEMINI_SETUP.md) for detailed instructions.

### 3. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```
Backend runs on http://localhost:3001

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs on http://localhost:3000

### 4. Use the Application

1. Open http://localhost:3000
2. Add some content (notes or URLs)
3. Ask questions about your saved content
4. View AI-generated answers with source citations

## API Endpoints

### POST /api/ingest
Ingest text content or URL
```json
{
  "type": "text",
  "content": "Your text here"
}
```
or
```json
{
  "type": "url",
  "url": "https://example.com/article"
}
```

### GET /api/items
List all saved items

### GET /api/items/:id
Get specific item by ID

### POST /api/query
Query the knowledge base
```json
{
  "question": "What is the main topic?",
  "topK": 5
}
```

### GET /health
Health check endpoint

## Architecture & Design Decisions

### Chunking Strategy
- **Approach**: Fixed-size chunking (500 tokens ≈ 2000 chars) with 100-token overlap
- **Rationale**: Simple, predictable, handles most content well
- **Trade-off**: May split semantic units; better than no overlap for context preservation
- **Scale Limitation**: Works for articles/notes; struggles with highly structured content (tables, code)

### Vector Storage
- **Current**: In-memory HNSW (hnswlib-node) with SQLite metadata backup
- **Rationale**: Fast, simple, zero external dependencies
- **Trade-off**: Limited to ~10K items, lost on restart (can persist to disk)
- **Production Path**: Migrate to Pinecone, Weaviate, or Qdrant for:
  - Persistent storage
  - Horizontal scaling
  - Advanced filtering004` (768 dimensions)
- **Rationale**: Free tier available, good quality, fast inference
- **Trade-off**: Slightly lower dimensions than OpenAI but excellent performance
- **Alternative**: OpenAI `text-embedding-3-small` for potentially higher quality
- **Rationale**: Good quality/cost balance, fast inference
- **Trade-off**: API costs scale with content volume
- **Alternative**: Local models (all-MiniLM-L6-v2) for cost reduction at quality trade-off

### Error Handling
- Structured logging with request IDs
- Input validation at route level
- Clear HTTP status codes (400, 404, 500)
- User-friendly error messages
- Stack traces in development only

## Production Considerations

### What Breaks at Scale

1. **In-memory vector store** - Loses data on restart, RAM-limited
   - Solution: Persistent vector DB (Pinecone, Weaviate)

2. **Single server** - No load balancing or failover
   - Solution: Horizontal scaling with shared DB

3. **No rate limiting** - OpenAI API costs could spike
   - Solution: Redis-backed rate limiter

4. **No authentication** - Currently single-user
   - Solution: JWT auth with user-scoped data

5. **No caching** - Repeated queries hit LLM every time
   - Solution: Cache query results by embedding similarity

### Recommended Production Changes

- [ ] Add Redis for caching and rate limiting
- [ ] Implement user authentication (JWT)
- [ ] Use persistent vector database
- [ ] Add request queuing for expensive operations
- [ ] Implement proper logging (Winston, Datadog)
- [ ] Add monitoring and alerting
- [ ] Set up CI/CD pipeline
- [ ] Add comprehensive test coverage
- [ ] Implement database migrations
- [ ] Add backup/restore functionality

## Project Structure

```
Task/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   └── sqlite.js          # SQLite metadata storage
│   │   ├── services/
│   │   │   ├── embeddings.js      # OpenAI embeddings wrapper
│   │   │   ├── vectorStore.js     # HNSW vector index
│   │   │   ├── ingestion.js       # Content processing & chunking
│   │   │   └── query.js           # RAG query pipeline
│   │   ├── routes/
│   │   │   ├── ingest.js          # POST /ingest
│   │   │   ├── items.js           # GET /items
│   │   │   └── query.js           # POST /query
│   │   ├── middleware/
│   │   │   └── logger.js          # Logging & error handling
│   │   └── server.js              # Express app entry point
│   ├── data/                       # SQLite & vector index (gitignored)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AddContent.jsx     # Content input form
│   │   │   ├── ItemsList.jsx      # Display saved items
│   │   │   └── QueryInterface.jsx # Question & answer UI
│   │   ├── App.jsx                # Main app component
│   │   ├── main.jsx               # React entry point
│   │   └── *.css                  # Component styles
│   ├── index.html
│   └── package.json
├── .env.example                    # Environment template
├── .gitignore
└── README.md
```

## Environment Variables

```bash
# Required
GEMINI_API_KEY=your-key-here        # Get at: https://aistudio.google.com/app/apikey

# Optional (defaults shown)
PORT=3001                           # Backend server port
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_DIMENSIONS=768
TOP_K_RESULTS=5                     # Results per query
LLM_MODEL=gemini-1.5-flash
MAX_TOKENS=1000                     # Max LLM response length
```

## Development Notes

### Adding New Content Types
1. Update `IngestionService.processContent()` for custom extraction
2. Add type-specific handling in `/ingest` route
3. Update frontend `AddContent` component with new UI

### Improving Chunking
- Semantic chunking: Use sentence transformers to detect topic boundaries
- Recursive chunking: Split by paragraphs, then sentences, then tokens
- Metadata-aware: Preserve structure markers (headers, lists)

### Debugging
- Check logs for request IDs: `[abc123] POST /api/query - 200 (1250ms)`
- Health endpoint: `curl http://localhost:3001/health`
- Verify API key: Check `.env` file has `GEMINI_API_KEY` set

## License

MIT

## Interview Context

This project was built as an interview task to demonstrate:
- Full-stack development (React + Node.js)
- AI/ML integration (embeddings, RAG, LLM)
- System design thinking (trade-offs, scaling considerations)
- Code organization and best practices
- Production readiness awareness
