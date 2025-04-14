# Vector Embeddings Test

This directory contains tools to test if vector embeddings are being generated successfully and are being used in the Del Norte Course Selector application.

## Background

The application has two search methods:
1. **Vector Search** (using embeddings): More advanced semantic search that understands context and meaning
2. **Traditional Search** (using regex patterns): Fallback method when vector search is unavailable

The application is designed to use vector search as the primary method, but falls back to traditional search when:
- The OpenRouter API key is missing or invalid
- Embeddings generation fails
- Vector search returns no results

## What Was Fixed

We identified and fixed a discrepancy in the embedding models used:
- In VectorSearchService.js: Updated from `openai/text-embedding-ada-002` to `openai/text-embedding-3-small`
- This ensures consistency with the model used in server/index.js
- The newer model provides better semantic understanding and improved performance

## How to Test

The test script verifies that:
1. Vector embeddings are being generated successfully
2. The embeddings are stored correctly
3. Vector search is being used instead of falling back to traditional search

### Prerequisites

- Make sure the server is running (`npm start` in the project root)
- Ensure the OpenRouter API key is set in your .env file

### Running the Test

```bash
# Navigate to the project directory
cd del-norte-course-selector

# Run the test script
./run-embeddings-test.sh
```

The script will:
1. Check the current embeddings status
2. Process the PDF and generate embeddings if needed
3. Test vector search with multiple queries
4. Test the chat endpoint which should use vector search internally
5. Provide a final status check

### Understanding the Results

The test will output detailed logs and a summary at the end. Look for:

- **Vector search success rate**: Shows the percentage of test queries that successfully used vector search
- **Final status**: Should show "SUCCESS: Vector embeddings are generated and available for search!"

If the test shows that vector search is working correctly, it means the embeddings are being generated successfully and are being used as the primary search method.

## Troubleshooting

If the test fails, check:

1. **API Key**: Ensure the OpenRouter API key is correctly set in your .env file
2. **Server Status**: Make sure the server is running
3. **PDF Processing**: Check if the PDF was processed correctly
4. **Error Messages**: Look for specific error messages in the test output

## Additional Information

The test script creates a log file `embeddings-test-log.txt` with detailed output that can be used for further analysis.
