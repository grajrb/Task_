# System Design: AI Knowledge Inbox

## Overview
This document details the architectural decisions, trade-offs, and scaling considerations for the AI Knowledge Inbox application.

## Architecture Diagram

```
┌─────────────┐         ┌──────────────────────────────────┐
│   Browser   │────────▶│       Frontend (React)           │
│             │         │  - AddContent                    │
└─────────────┘         │  - ItemsList                     │
                        │  - QueryInterface                │
                        └──────────────┬───────────────────┘
                                       │ HTTP/JSON
                        ┌──────────────▼───────────────────┐
                        │   Express API Server             │
                        │  - /ingest  - /items  - /query   │
                        └──────────────┬───────────────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
       ┌────────▼──────────┐  ┌───────▼────────┐  ┌─────────▼─────────┐
       │ Ingestion Service │  │  Query Service │  │  Embedding Service│
       │  - Chunking       │  │  - Retrieval   │  │  - OpenAI API    │
       │  - Embedding      │  │  - Generation  │  │                   │
       └────────┬──────────┘  └───────┬────────┘  └───────────────────┘
                │                      │
       ┌────────▼──────────┐  ┌───────▼────────┐
       │   Vector Store    │  │  SQLite Store  │
       │  (HNSW in-memory) │  │  (Metadata)    │
       └───────────────────┘  └────────────────┘
```

## Data Flow

### Ingestion Flow
1. User submits text or URL via frontend
2. Frontend sends POST to `/api/ingest`
3. IngestionService:
   - Fetches URL content (if URL) using Cheerio
   - Chunks content (500 tokens, 100 overlap)
   - Generates embeddings via OpenAI API
   - Stores metadata in SQLite
   - Adds embeddings to vector store
4. Returns success with item ID

### Query Flow
1. User asks question via frontend
2. Frontend sends POST to `/api/query`
3. QueryService:
   - Generates question embedding
   - Searches vector store for top-K similar chunks
   - Retrieves chunk metadata from SQLite
   - Builds context from retrieved chunks
   - Calls OpenAI GPT with context + question
   - Returns answer with source citations
4. Frontend displays answer and sources

## Key Design Decisions

### 1. Chunking Strategy

**Decision**: Fixed-size chunking with overlap
- Size: 500 tokens (~2000 characters)
- Overlap: 100 tokens (~400 characters)

**Rationale**:
- Simple to implement and debug
- Predictable memory usage
- Works well for most text content
- Overlap prevents context loss at boundaries

**Trade-offs**:
| Pros | Cons |
|------|------|
| Easy to reason about | May split semantic units |
| Fast processing | Suboptimal for structured content |
| Consistent chunk sizes | Fixed size doesn't adapt to content |

**Alternatives Considered**:
- Semantic chunking (sentence transformers): More accurate but slower
- Recursive splitting: Better for code/structured data, more complex
- Paragraph-based: Natural boundaries but variable sizes

**When it breaks**:
- Tables and structured data get split poorly
- Very long sentences may be cut mid-context
- Code blocks lose formatting context

### 2. Vector Storage

**Decision**: In-memory HNSW (hnswlib-node)

**Rationale**:
- Zero external dependencies
- Fast search (<10ms for 1K vectors)
- Easy local development
- Sufficient for prototype/demo

**Trade-offs**:
| Pros | Cons |
|------|------|
| Fast (cosine search in ms) | Lost on server restart |
| No infrastructure needed | Limited to RAM capacity (~10K items) |
| Simple to use | No built-in persistence |
| Good for development | Single-machine only |

**Scale Limitations**:
- **Memory**: ~1.5KB per embedding × 10K items = ~15MB (manageable)
- **Concurrency**: No locking, race conditions possible
- **Persistence**: Requires manual save/load
- **Distributed**: Impossible to scale horizontally

**Production Migration Path**:
```
In-memory HNSW → Pinecone/Weaviate/Qdrant
                  
Why:
- Persistent storage
- Horizontal scaling
- Advanced filtering (metadata)
- Managed infrastructure
- Higher capacity (millions of vectors)
```

### 3. Embeddings Model

**Decision**: OpenAI `text-embedding-3-small`

**Specifications**:
- Dimensions: 1536
- Context window: 8191 tokens
- Cost: $0.02 per 1M tokens
- Quality: High (better than ada-002)

**Rationale**:
- Best quality-to-cost ratio
- Fast inference
- Good semantic understanding
- Official OpenAI support

**Trade-offs**:
| Pros | Cons |
|------|------|
| High quality | API costs scale with usage |
| Fast (<200ms) | Requires internet connection |
| No model management | Vendor lock-in |
| Latest tech | Rate limits apply |

**Cost Analysis** (at scale):
```
Assumptions:
- Average chunk: 400 tokens
- 100 items/day, 5 chunks each = 500 chunks/day
- 500 × 400 = 200K tokens/day

Monthly cost:
200K tokens/day × 30 days = 6M tokens/month
6M tokens × $0.02 / 1M = $0.12/month (negligible)

At 1000x scale: ~$120/month (still reasonable)
```

**Alternative**: Local models (e.g., `all-MiniLM-L6-v2`)
- Pros: No API costs, offline capable
- Cons: Lower quality, requires GPU, model management

### 4. LLM for Answer Generation

**Decision**: GPT-4o-mini

**Rationale**:
- Excellent quality-to-cost ratio
- Fast responses (<2s typically)
- Good at following instructions
- Cost-effective for production

**Trade-offs**:
| Aspect | GPT-4o-mini | Alternatives |
|--------|------------|--------------|
| Quality | Very good | GPT-4: Better, GPT-3.5: Worse |
| Speed | Fast (~1-2s) | GPT-4: Slower (3-5s) |
| Cost | $0.15/1M input | GPT-4: $30/1M (200x) |
| Context | 128K tokens | Sufficient for RAG |

**Cost Analysis**:
```
Average query:
- Context: 5 chunks × 400 tokens = 2K tokens
- Question: ~50 tokens
- Answer: ~200 tokens
Total: ~2.3K tokens per query

Cost per query: 2.3K × $0.15 / 1M ≈ $0.0003
At 10K queries/month: $3/month

At 1M queries/month: $300/month (consider caching)
```

### 5. Database Architecture

**Decision**: Dual storage (SQLite + Vector Store)

**Rationale**:
- SQLite: Persistent metadata, transactions, queries
- Vector Store: Fast similarity search
- Each optimized for its purpose

**Schema Design**:
```sql
-- items: Raw content and metadata
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- 'text' or 'url'
  content TEXT NOT NULL,        -- Full content
  metadata TEXT,                -- JSON blob
  created_at INTEGER NOT NULL
);

-- chunks: Individual searchable pieces
CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  content TEXT NOT NULL,        -- Chunk text
  chunk_index INTEGER NOT NULL,
  embedding_id INTEGER NOT NULL, -- Vector store reference
  FOREIGN KEY (item_id) REFERENCES items(id)
);
```

**Why Not Just Vector DB with Metadata?**
- Vector DBs optimize for similarity, not relational queries
- Need ACID transactions for data integrity
- Complex queries (filter by date, type, etc.) easier in SQL
- Clear separation of concerns

### 6. API Design

**Decisions**:
- RESTful endpoints
- JSON request/response
- Structured error handling
- Request ID tracking

**Endpoint Design**:
```
POST /api/ingest
  Input: { type, content?, url?, metadata? }
  Output: { success, itemId, message }
  Status: 201 Created | 400 Bad Request

GET /api/items
  Output: { success, count, items[] }
  Status: 200 OK

POST /api/query
  Input: { question, topK? }
  Output: { success, question, answer, sources[], confidence }
  Status: 200 OK | 400 Bad Request
```

**Error Handling Philosophy**:
- 400: User error (bad input)
- 404: Resource not found
- 500: Server error (our fault)
- Include request ID for debugging
- User-friendly messages
- Stack traces only in development

## Scaling Considerations

### What Breaks First?

**At 100 users:**
- ✅ Current architecture works fine
- Monitor: OpenAI API costs

**At 1,000 users:**
- ⚠️ In-memory vector store approaching limits
- ⚠️ Single server may bottleneck
- Solution: Add caching, consider vector DB

**At 10,000 users:**
- ❌ Must migrate to persistent vector DB
- ❌ Need horizontal scaling
- ❌ Rate limiting essential
- ❌ Multi-tenancy architecture

### Bottleneck Analysis

| Component | Current Limit | Bottleneck | Solution |
|-----------|--------------|-----------|----------|
| Vector Store | ~10K items | RAM | Pinecone/Weaviate |
| SQLite | ~1M items | Disk I/O | PostgreSQL |
| OpenAI API | Rate limits | API quota | Caching + queue |
| Single Server | ~100 RPS | CPU/Network | Load balancer |
| No Auth | Single user | Security | JWT + user scoping |

### Production Architecture Evolution

**Phase 1: Current (MVP)**
```
[React] → [Express + SQLite + HNSW] → [OpenAI]
```

**Phase 2: Enhanced (1K users)**
```
[React] → [Express + Redis Cache] → [PostgreSQL + Pinecone] → [OpenAI]
```

**Phase 3: Scaled (10K+ users)**
```
                  ┌─[Express]─┐
[React] → [LB] → ├─[Express]─┤ → [Redis] → [PostgreSQL]
                  └─[Express]─┘      ↓
                                [Pinecone]
                                     ↓
                                [OpenAI]
```

## Performance Characteristics

### Current Performance

**Ingestion** (text):
- Chunking: ~50ms
- Embedding generation: ~200ms per chunk
- Storage: ~10ms
- **Total**: ~1-5 seconds (depends on length)

**Ingestion** (URL):
- Fetch: ~500-2000ms (varies)
- Content extraction: ~50ms
- Chunking + embedding: ~1-5s
- **Total**: ~2-7 seconds

**Query**:
- Embedding generation: ~200ms
- Vector search: ~5ms
- LLM generation: ~1-2s
- **Total**: ~1.5-2.5 seconds

### Optimization Opportunities

1. **Batch Embedding Generation**
   - Current: Sequential per chunk
   - Improvement: Batch 100 chunks → 10x faster
   - Impact: Ingestion time cut by 80%

2. **Query Result Caching**
   - Strategy: Cache by question embedding similarity
   - Hit rate: ~30-40% for common questions
   - Impact: 2s → 50ms for cache hits

3. **Background Processing**
   - Move ingestion to queue (Bull/BullMQ)
   - Return immediately, process async
   - Impact: User sees instant feedback

## Security Considerations

**Current State**:
- ❌ No authentication
- ❌ No rate limiting
- ✅ Input validation
- ✅ SQL injection prevention (parameterized queries)
- ⚠️ URL fetching (potential SSRF)

**Production Requirements**:
- [ ] JWT-based authentication
- [ ] Rate limiting (per user/IP)
- [ ] Content Security Policy headers
- [ ] HTTPS only
- [ ] URL whitelist/blacklist
- [ ] Input sanitization
- [ ] API key rotation
- [ ] Audit logging

## Monitoring & Observability

**Current**: Console logs only

**Production Needs**:
- Structured logging (Winston + ELK/Datadog)
- Metrics (Prometheus):
  - Request latency (p50, p95, p99)
  - Error rates
  - OpenAI API calls & costs
  - Vector store size
  - Cache hit rates
- Alerts:
  - Error rate > 5%
  - Latency p95 > 5s
  - OpenAI API errors
  - Disk/memory usage > 80%

## Cost Projections

**At 1,000 active users** (10 queries/day, 2 items/day):

| Component | Usage | Cost/Month |
|-----------|-------|------------|
| OpenAI Embeddings | 60M tokens | ~$1.20 |
| OpenAI LLM | 23M tokens | ~$3.50 |
| Server (AWS t3.medium) | 24/7 | ~$30 |
| PostgreSQL (RDS) | db.t3.micro | ~$15 |
| Pinecone (Starter) | 100K vectors | ~$70 |
| **Total** | | **~$120/month** |

**At 10,000 users**: ~$800/month (with caching)

## Testing Strategy

**Current**: Manual testing only

**Production Coverage**:
- Unit tests: Services, utilities (80% coverage goal)
- Integration tests: API endpoints
- E2E tests: Critical user flows
- Load tests: 100 RPS for 10 minutes
- Chaos testing: Service failures

## Conclusion

This architecture balances simplicity with production-readiness awareness. The current implementation works well for the interview context and can handle small-scale production use. Clear migration paths exist for each component as scale demands it.

**Key Strengths**:
- Clean separation of concerns
- Extensible architecture
- Production-aware trade-offs
- Clear scaling path

**Known Limitations**:
- In-memory storage
- Single-server architecture
- No authentication
- Limited monitoring

**Recommended Next Steps** (in priority order):
1. Add persistent vector DB (Pinecone/Weaviate)
2. Implement authentication
3. Add Redis caching
4. Set up monitoring/alerts
5. Add comprehensive tests
