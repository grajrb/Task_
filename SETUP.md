# Setup Instructions

## Quick Start Guide

### 1. Prerequisites
- Node.js 18 or higher
- Google Gemini API key (FREE tier available!)

### 2. Get Your Gemini API Key
1. Visit https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key

### 3. Configure the Application
Open `.env` file in the root directory and paste your Gemini API key:
```
GEMINI_API_KEY=your-actual-key-here
```

### 4. Start the Backend
```bash
cd backend
npm start
```
Backend will run on http://localhost:3001

### 5. Start the Frontend (in a new terminal)
```bash
cd frontend
npm run dev
```
Frontend will run on http://localhost:3000

### 6. Use the Application
1. Open your browser to http://localhost:3000
2. Add some content:
   - Text notes (paste any text)
   - URLs (articles, documentation, etc.)
3. Wait for content to be processed (~2-5 seconds)
4. Ask questions about your saved content
5. View AI-generated answers with source citations

## Testing the Application

### Test with Sample Content

**Sample Text Note:**
```
Artificial Intelligence (AI) is the simulation of human intelligence by machines. 
Machine learning is a subset of AI that enables systems to learn from data. 
Deep learning uses neural networks with multiple layers to process information.
```

**Sample URLs to Try:**
- https://en.wikipedia.org/wiki/Artificial_intelligence
- https://docs.python.org/3/tutorial/
- Any blog post or article

**Sample Questions:**
- "What is machine learning?"
- "How does deep learning differ from AI?"
- "What are the main topics covered?"

## Troubleshooting

### "GEMINI_API_KEY is not set"
- Make sure you created the `.env` file
- Check that your API key is correctly pasted
- Restart the backend server after changing `.env`

### "Failed to fetch URL"
- Some websites block automated requests
- Try a different URL
- Check your internet connection

### Port Already in Use
If port 3001 or 3000 is already in use:
- Backend: Change PORT in `.env` file
- Frontend: Change port in `frontend/vite.config.js`

### Dependencies Installation Failed
Run these commands:
```bash
cd backend
rm -rf node_modules package-lock.json
npm install

cd ../frontend  
rm -rf node_modules package-lock.json
npm install
```

## Development Mode

### Backend with Auto-Reload
```bash
cd backend
npm run dev
```

### Frontend with Hot Module Replacement
```bash
cd frontend
npm run dev
```

## API Testing

### Health Check
```bash
curl http://localhost:3001/health
```

### Add Text Content
```bash
curl -X POST http://localhost:3001/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"type": "text", "content": "Your text here"}'
```

### Query
```bash
curl -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What is this about?"}'
```

## Architecture Overview

```
┌─────────────┐
│   Browser   │ ← User Interface (React)
└──────┬──────┘
       │ HTTP/JSON
┌──────▼──────┐
│   Express   │ ← API Server (Node.js)
│   Server    │
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
┌──▼───┐ ┌▼─────────┐
│ Data │ │  OpenAI  │
│Store │ │   API    │
└──────┘ └──────────┘
```

### Data Flow
1. **Ingestion**: Content → Chunking → Embeddings → Storage
2. **Query**: Question → Embedding → Vector Search → Context → LLM → Answer

## Next Steps

Once you have the app running:
1. Add 3-5 pieces of content (notes or URLs)
2. Ask questions to test the RAG pipeline
3. Explore the source code
4. Review system design document (SYSTEM_DESIGN.md)

## Cost Estimates

**With Gemini Free Tier:**
- Up to 1,500 requests/day: **$0**
- Perfect for testing and small production use
- No credit card required!

**If You Exceed Free Tier:**
- ~1000 queries: ~$0.20
- ~100 items: ~$0.05
- Much cheaper than OpenAI!
