# Setting Up ChromaDB for Vector Embeddings

This guide explains how to set up ChromaDB for vector embeddings in the Del Norte Course Selector application.

## Overview

The application has been updated to use ChromaDB for vector storage and search, with OpenRouter API for generating embeddings. This provides several advantages over the previous in-memory approach:

1. **Persistence**: Embeddings are stored in a database and persist between application restarts
2. **Scalability**: ChromaDB can handle much larger datasets than the in-memory approach
3. **Performance**: ChromaDB is optimized for vector search and provides better performance
4. **Quality**: Using OpenRouter API for embeddings provides higher quality results than the simple TF-IDF approach

## Prerequisites

- Node.js 18.x or higher
- Docker (for running ChromaDB)
- OpenRouter API key (already configured in `.env`)

## Setup Instructions

### 1. Install ChromaDB using Docker

The easiest way to run ChromaDB is using Docker:

```bash
# Pull the ChromaDB Docker image
docker pull chromadb/chroma

# Run ChromaDB in a Docker container
docker run -p 8000:8000 chromadb/chroma
```

This will start a ChromaDB server on port 8000.

### 2. Update Environment Variables

Add the following environment variable to your `.env` file:

```
CHROMADB_URL=http://localhost:8000
```

If you're running ChromaDB on a different host or port, update the URL accordingly.

### 3. Replace the VectorSearchService Implementation

Replace the current VectorSearchService implementation with the new one:

```bash
# Backup the current implementation
cp server/services/VectorSearchService.js server/services/VectorSearchService.js.bak

# Replace with the new implementation
cp server/services/VectorSearchService.js.new server/services/VectorSearchService.js
```

### 4. Restart the Application

Restart the application to use the new ChromaDB implementation:

```bash
npm start
```

## How It Works

The new implementation:

1. Connects to ChromaDB on startup
2. Creates a collection for storing course catalog embeddings
3. Uses OpenRouter API to generate embeddings for text chunks
4. Stores the embeddings in ChromaDB
5. Searches ChromaDB for relevant content based on user queries

If ChromaDB is not available or if there's an error connecting to it, the implementation falls back to the previous in-memory approach.

## Troubleshooting

### ChromaDB Connection Issues

If you see errors like "Failed to initialize ChromaDB" in the logs, check that:

1. ChromaDB is running and accessible at the URL specified in the `CHROMADB_URL` environment variable
2. There are no network issues preventing the application from connecting to ChromaDB

### Embedding Generation Issues

If you see errors like "Error generating embeddings" in the logs, check that:

1. The OpenRouter API key is correctly configured in the `.env` file
2. The OpenRouter API is accessible from your network
3. The API key has sufficient quota remaining

## Monitoring

You can monitor the ChromaDB status using the application's health endpoint:

```bash
curl http://localhost:3003/health
```

This will show information about the vector search status, including:

- Whether vector search is available
- The number of vectors in the database
- The course counts for each category

## Advanced Configuration

### Using a Different Embedding Model

The implementation currently uses `anthropic/claude-3-haiku-20240307` for generating embeddings. If you want to use a different model, you can modify the `generateEmbeddings` method in `VectorSearchService.js`.

### Persistent Storage for ChromaDB

By default, ChromaDB stores data in memory. For production use, you should configure persistent storage:

```bash
# Create a directory for ChromaDB data
mkdir -p ~/chromadb_data

# Run ChromaDB with persistent storage
docker run -p 8000:8000 -v ~/chromadb_data:/chroma/chroma chromadb/chroma
```

This will store ChromaDB data in the `~/chromadb_data` directory, which will persist between container restarts.
