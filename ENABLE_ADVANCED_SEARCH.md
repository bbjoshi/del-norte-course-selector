# Enable Advanced Search Feature

## Overview
Your application already has an **advanced search feature** implemented using AI-powered vector embeddings! This feature provides semantic search capabilities that understand the meaning of queries, not just keyword matching.

## Current Status
The advanced search feature is **implemented but not yet activated**. It needs to be enabled by:
1. Starting the backend server
2. Allowing the server to generate AI embeddings from the course catalog PDF

## How Advanced Search Works

### Traditional Search (Fallback)
- Uses keyword matching and regex patterns
- Searches for exact words or phrases
- Limited understanding of context

### Advanced Search (Vector Search)
- Uses AI embeddings to understand semantic meaning
- Finds relevant content even if exact keywords don't match
- Example: Searching for "engineering pathway" will find related courses even if they don't contain those exact words
- Powered by Claude AI via OpenRouter API

## Steps to Enable Advanced Search

### 1. Verify API Key Configuration
Your `.env` file already has the OpenRouter API key configured:
```
REACT_APP_OPENROUTER_API_KEY=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
```
✅ This is already set up correctly!

### 2. Start the Backend Server
Open a terminal and run:
```bash
npm start
```

Or if you prefer to run both frontend and backend:
```bash
# Terminal 1 - Backend
npm start

# Terminal 2 - Frontend
npm run dev
```

### 3. Wait for Embeddings Generation
When the server starts and a user first accesses the application:
- The server will automatically fetch the course catalog PDF
- It will generate AI embeddings for the content (this takes 2-5 minutes)
- Progress will be displayed in the chat interface
- Once complete, advanced search will be automatically enabled

### 4. Monitor Progress
You can check the embeddings generation status by:

**Option A: In the Application**
- Open the application in your browser
- The chat interface will show a progress bar during embeddings generation
- Once complete, you'll see "Advanced search enabled" in the logs

**Option B: Via API Endpoint**
```bash
# Check status
curl http://localhost:3003/api/embeddings-status

# Check detailed debug info
curl http://localhost:3003/debug/pdf-status
```

**Option C: Server Logs**
Watch the server console for messages like:
```
Starting embeddings generation for X chunks...
Embeddings generation progress updated: 50%
Successfully generated embeddings for X chunks
```

## How to Verify Advanced Search is Working

### Method 1: Check Server Logs
Look for these messages in the server console:
```
Successfully added X vectors to in-memory store
Vector search available: true
```

### Method 2: Test a Query
In the chat interface, try a semantic query like:
- "What courses prepare me for computer science?"
- "Show me engineering pathways"
- "Courses for pre-med students"

If advanced search is working, you'll see in the server logs:
```
Performing vector search for query: "..."
Found X results from vector search
```

If it falls back to traditional search, you'll see:
```
Falling back to traditional search...
```

### Method 3: Check the API
```bash
curl "http://localhost:3003/api/embeddings-status"
```

Expected response when enabled:
```json
{
  "inProgress": false,
  "complete": true,
  "error": null,
  "progress": 100,
  "vectorCount": 150,
  "vectorSearchAvailable": true
}
```

## Troubleshooting

### Issue: Embeddings Generation Fails
**Symptoms:**
- Error messages in server logs
- `embeddingsGenerationError` is not null
- Falls back to traditional search

**Solutions:**
1. **Check API Key**: Verify the OpenRouter API key is valid
2. **Check API Quota**: Ensure you haven't exceeded your OpenRouter API limits
3. **Check Network**: Ensure the server can reach openrouter.ai
4. **Review Logs**: Check server console for detailed error messages

### Issue: Embeddings Cache
The system caches embeddings in `embeddings-cache.json` to avoid regenerating them:
- **First run**: Takes 2-5 minutes to generate embeddings
- **Subsequent runs**: Loads from cache instantly (< 1 second)
- **To regenerate**: Delete `embeddings-cache.json` and restart the server

### Issue: Server Won't Start
```bash
# Check if port 3003 is already in use
netstat -ano | findstr :3003

# Kill the process if needed (replace PID with actual process ID)
taskkill /PID <PID> /F

# Restart the server
npm run server
```

## Performance Optimization

### Embeddings Cache
- Location: `embeddings-cache.json`
- Purpose: Stores generated embeddings to avoid regeneration
- Size: ~500KB - 2MB depending on PDF size
- **Keep this file** for faster startup times

### Cache Statistics
Check cache performance:
```javascript
// In server logs, you'll see:
Cache hit! Using X cached embeddings
Cache partial hit. Generating embeddings for X of Y texts
```

## Advanced Configuration

### Adjust Vector Search Parameters
Edit `server/services/VectorSearchService.js`:

```javascript
// Change number of results returned
async search(query, topK = 5) {  // Change 5 to desired number
```

### Adjust Chunk Size
Edit `server/services/PDFService.js`:

```javascript
// Change how PDF is split into chunks
splitTextIntoChunks(text, chunkSize = 500, overlap = 50) {
  // Adjust chunkSize and overlap as needed
}
```

### Change AI Model
Edit `server/services/VectorSearchService.js`:

```javascript
// Line ~100 - Change the model used for embeddings
model: 'anthropic/claude-3-haiku:20240307',  // Faster, cheaper
// or
model: 'anthropic/claude-3-sonnet:20240229', // Better quality
```

## Feature Comparison

| Feature | Traditional Search | Advanced Search (Vector) |
|---------|-------------------|-------------------------|
| Speed | ⚡ Instant | ⚡ Fast (cached) |
| Accuracy | ✓ Good for exact matches | ✓✓ Excellent for semantic queries |
| Setup Time | None | 2-5 minutes (first time only) |
| API Costs | Free | ~$0.01-0.05 per generation |
| Offline Support | ✓ Yes | ✗ Requires API (but uses cache) |

## Cost Considerations

### OpenRouter API Costs
- **Embeddings Generation**: ~$0.01-0.05 (one-time per PDF)
- **Cached Embeddings**: $0 (uses local cache)
- **Search Queries**: $0 (uses local vector comparison)

### Optimization Tips
1. **Keep the cache file**: Avoid regenerating embeddings
2. **Use Haiku model**: Cheaper for embeddings generation
3. **Adjust chunk size**: Fewer chunks = lower cost

## Next Steps

1. **Start the server**: `npm run server`
2. **Open the application**: Navigate to http://localhost:3002
3. **Wait for embeddings**: Watch the progress bar in the chat interface
4. **Test advanced search**: Try semantic queries
5. **Monitor performance**: Check server logs for "vector search" messages

## Support

If you encounter issues:
1. Check server logs for error messages
2. Verify API key is valid
3. Check `embeddings-cache.json` exists after first run
4. Review the troubleshooting section above
5. Check OpenRouter API status at https://openrouter.ai/status

---

**Status**: Advanced search is implemented and ready to use! Just start the server and let it generate embeddings.
