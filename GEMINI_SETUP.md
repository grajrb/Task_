# Google Gemini API Setup

## Getting Your Gemini API Key

1. **Visit Google AI Studio**
   - Go to: https://aistudio.google.com/app/apikey
   - Sign in with your Google account

2. **Create API Key**
   - Click "Create API Key"
   - Choose "Create API key in new project" or select an existing project
   - Copy the generated API key

3. **Add to Environment**
   - Open the `.env` file in the project root
   - Paste your key:
     ```
     GEMINI_API_KEY=your-api-key-here
     ```

## Why Gemini?

**Advantages:**
- **Free tier**: 15 requests per minute, 1500 requests per day
- **Cost-effective**: Much cheaper than OpenAI for paid usage
- **Fast**: Low latency responses
- **Capable**: Gemini 1.5 Flash is highly capable for RAG tasks
- **Generous limits**: 1M tokens/minute rate limit

**Models Used:**
- **Embeddings**: `text-embedding-004` (768 dimensions)
- **LLM**: `gemini-1.5-flash` (fast, cost-effective)

## Pricing Comparison

| Provider | Embeddings | LLM Generation |
|----------|-----------|----------------|
| **Gemini** (Free) | FREE up to 1500/day | FREE up to 1500/day |
| **Gemini** (Paid) | $0.00001/1K tokens | $0.075/1M input tokens |
| OpenAI | $0.02/1M tokens | $0.15/1M tokens |

**For this app (typical usage):**
- ~100 items/month: **FREE** with Gemini
- ~1000 queries/month: **FREE** with Gemini
- Even at scale: Gemini is ~5-10x cheaper than OpenAI

## Rate Limits

**Free Tier:**
- 15 requests per minute
- 1,500 requests per day
- 1 million tokens per minute

**Paid Tier:**
- 1,000 requests per minute
- 1 million tokens per minute
- Much higher daily quota

## Alternative: Perplexity API

If you prefer Perplexity, I can also configure that. Perplexity offers:
- Focused on search-augmented responses
- Multiple model options (Llama, Claude, GPT)
- Different pricing structure

Let me know if you'd like Perplexity support instead!

## Testing Your Setup

After adding your API key:

```bash
cd backend
npm install
npm start
```

You should see:
```
[Server] Using Google Gemini API
[Server] Embedding model: text-embedding-004
[Server] LLM model: gemini-1.5-flash
```

## Troubleshooting

**"GEMINI_API_KEY is not set"**
- Check that `.env` file exists in project root
- Verify the key is not wrapped in quotes
- Restart the backend server

**"API key not valid"**
- Verify you copied the complete key
- Check for extra spaces or newlines
- Generate a new key if needed

**Rate limit errors**
- Free tier: Wait a minute between batches
- Consider upgrading to paid tier
- Add retry logic with exponential backoff
