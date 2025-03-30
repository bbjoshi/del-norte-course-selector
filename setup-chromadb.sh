#!/bin/bash

# Setup script for ChromaDB in Del Norte Course Selector

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    echo "Visit https://docs.docker.com/get-docker/ for installation instructions."
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "Docker is not running. Please start Docker first."
    exit 1
fi

echo "Checking for existing ChromaDB container..."
EXISTING_CONTAINER=$(docker ps -a --filter "name=chromadb" --format "{{.ID}}")

if [ -n "$EXISTING_CONTAINER" ]; then
    echo "Found existing ChromaDB container. Checking if it's running..."
    
    RUNNING_CONTAINER=$(docker ps --filter "name=chromadb" --format "{{.ID}}")
    
    if [ -n "$RUNNING_CONTAINER" ]; then
        echo "ChromaDB container is already running."
    else
        echo "Starting existing ChromaDB container..."
        docker start $EXISTING_CONTAINER
        echo "ChromaDB container started."
    fi
else
    echo "No existing ChromaDB container found. Creating a new one..."
    
    # Create data directory for persistent storage
    echo "Creating data directory for persistent storage..."
    mkdir -p ~/chromadb_data
    
    # Pull the ChromaDB Docker image
    echo "Pulling ChromaDB Docker image..."
    docker pull chromadb/chroma
    
    # Run ChromaDB in a Docker container with persistent storage
    echo "Running ChromaDB in a Docker container..."
    docker run -d --name chromadb -p 8000:8000 -v ~/chromadb_data:/chroma/chroma chromadb/chroma
    
    echo "ChromaDB container created and started."
fi

# Wait for ChromaDB to start
echo "Waiting for ChromaDB to start..."
sleep 5

# Check if ChromaDB is running
echo "Checking if ChromaDB is running..."
if curl -s http://localhost:8000/api/v1/heartbeat &> /dev/null; then
    echo "ChromaDB is running."
else
    echo "ChromaDB is not running. Please check the Docker container logs:"
    echo "docker logs chromadb"
    exit 1
fi

# Update .env file with ChromaDB URL
echo "Updating .env file with ChromaDB URL..."
if grep -q "CHROMADB_URL" .env; then
    # Replace existing CHROMADB_URL
    sed -i '' 's|CHROMADB_URL=.*|CHROMADB_URL=http://localhost:8000|g' .env
else
    # Add CHROMADB_URL
    echo "" >> .env
    echo "# ChromaDB URL" >> .env
    echo "CHROMADB_URL=http://localhost:8000" >> .env
fi

# Backup and replace VectorSearchService implementation
echo "Backing up current VectorSearchService implementation..."
cp server/services/VectorSearchService.js server/services/VectorSearchService.js.bak

echo "Replacing VectorSearchService implementation..."
cp server/services/VectorSearchService.js.new server/services/VectorSearchService.js

echo "Setup complete!"
echo ""
echo "To start the application with ChromaDB, run:"
echo "npm start"
echo ""
echo "To stop ChromaDB when you're done, run:"
echo "docker stop chromadb"
echo ""
echo "To start ChromaDB again later, run:"
echo "docker start chromadb"
