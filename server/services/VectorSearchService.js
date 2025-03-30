const { ChromaClient } = require('chromadb');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

/**
 * Service for handling vector search operations using ChromaDB
 */
class VectorSearchService {
  constructor() {
    this.client = null;
    this.collection = null;
    this.collectionName = 'course_catalog';
    this.vectorSearchAvailable = false;
    this.vectorCount = 0;
    
    // Initialize ChromaDB
    this.initializeChromaDB();
  }

  /**
   * Initialize ChromaDB client and collection
   */
  async initializeChromaDB() {
    try {
      console.log('Initializing ChromaDB...');
      
      // Create ChromaDB client
      this.client = new ChromaClient({
        path: process.env.CHROMADB_URL || 'http://localhost:8000'
      });
      
      // Check if ChromaDB is available
      await this.client.heartbeat();
      console.log('ChromaDB is available');
      
      // Get or create collection
      const collections = await this.client.listCollections();
      if (collections.some(c => c.name === this.collectionName)) {
        console.log(`Collection ${this.collectionName} already exists`);
        this.collection = await this.client.getCollection({
          name: this.collectionName
        });
        
        // Get count of vectors in collection
        const count = await this.collection.count();
        this.vectorCount = count;
        console.log(`Collection has ${count} vectors`);
      } else {
        console.log(`Creating new collection: ${this.collectionName}`);
        this.collection = await this.client.createCollection({
          name: this.collectionName,
          metadata: { description: 'Del Norte High School Course Catalog' }
        });
      }
      
      this.vectorSearchAvailable = true;
      console.log('ChromaDB initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ChromaDB:', error);
      this.vectorSearchAvailable = false;
      
      // Fall back to in-memory vector store if ChromaDB is not available
      console.log('Falling back to in-memory vector store');
      this.inMemoryVectors = [];
      this.vocabulary = new Set();
    }
  }

  /**
   * Generate embeddings using OpenRouter API
   * @param {string[]} texts - Array of text chunks to generate embeddings for
   * @returns {Promise<number[][]>} - Array of embedding vectors
   */
  async generateEmbeddings(texts) {
    try {
      const apiKey = process.env.OPENROUTER_API_KEY || process.env.REACT_APP_OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error('No API key configured for OpenRouter');
      }

      console.log(`Generating embeddings for ${texts.length} text chunks using OpenRouter API...`);
      
      const response = await axios.post(
        'https://openrouter.ai/api/v1/embeddings',
        {
          model: 'anthropic/claude-3-haiku-20240307',
          input: texts
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://del-norte-course-selector.vercel.app',
            'X-Title': 'Del Norte Course Selector'
          }
        }
      );

      console.log(`Successfully generated ${texts.length} embeddings`);
      return response.data.data.map(item => item.embedding);
    } catch (error) {
      console.error('Error generating embeddings:', error);
      
      // Fall back to simple TF-IDF embeddings if OpenRouter API fails
      console.log('Falling back to simple TF-IDF embeddings');
      return this.generateSimpleEmbeddings(texts);
    }
  }

  /**
   * Generate simple embeddings using TF-IDF like approach (fallback method)
   * @param {string[]} texts - Array of text chunks to generate embeddings for
   * @returns {Promise<number[][]>} - Array of embedding vectors
   */
  async generateSimpleEmbeddings(texts) {
    try {
      console.log(`Generating simple embeddings for ${texts.length} text chunks`);
      
      // Tokenize texts
      const tokenizedTexts = texts.map(text => {
        // Convert to lowercase, remove punctuation, and split into words
        const words = text.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(word => word.length > 3); // Only keep words longer than 3 characters
        
        // Add words to vocabulary
        words.forEach(word => this.vocabulary.add(word));
        
        return words;
      });
      
      // Convert vocabulary to array for indexing
      const vocabularyArray = Array.from(this.vocabulary);
      console.log(`Vocabulary size: ${vocabularyArray.length} words`);
      
      // Create embeddings (term frequency vectors)
      const embeddings = tokenizedTexts.map(words => {
        // Initialize vector with zeros
        const vector = new Array(vocabularyArray.length).fill(0);
        
        // Count word occurrences
        words.forEach(word => {
          const index = vocabularyArray.indexOf(word);
          if (index !== -1) {
            vector[index]++;
          }
        });
        
        // Normalize vector (L2 normalization)
        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        if (magnitude > 0) {
          for (let i = 0; i < vector.length; i++) {
            vector[i] /= magnitude;
          }
        }
        
        return vector;
      });
      
      console.log(`Successfully generated ${embeddings.length} simple embeddings`);
      return embeddings;
    } catch (error) {
      console.error('Error generating simple embeddings:', error);
      // Return empty array to gracefully degrade to traditional search
      return [];
    }
  }

  /**
   * Add vectors to the vector database
   * @param {Array<{id: string, text: string, embedding: number[]}>} vectors - Vectors to add
   */
  async addVectors(vectors) {
    if (!this.vectorSearchAvailable) {
      console.log('Vector search not available, adding to in-memory store');
      this.inMemoryVectors = [...(this.inMemoryVectors || []), ...vectors];
      return;
    }
    
    try {
      if (!this.collection) {
        throw new Error('ChromaDB collection not initialized');
      }
      
      console.log(`Adding ${vectors.length} vectors to ChromaDB...`);
      
      // Prepare data for ChromaDB
      const ids = vectors.map(v => v.id);
      const documents = vectors.map(v => v.text);
      const embeddings = vectors.map(v => v.embedding);
      const metadatas = vectors.map(() => ({}));
      
      // Add vectors to ChromaDB
      await this.collection.add({
        ids,
        embeddings,
        metadatas,
        documents
      });
      
      // Update vector count
      this.vectorCount += vectors.length;
      console.log(`Successfully added vectors to ChromaDB. Total: ${this.vectorCount}`);
    } catch (error) {
      console.error('Error adding vectors to ChromaDB:', error);
      
      // Fall back to in-memory vector store if ChromaDB fails
      console.log('Falling back to in-memory vector store');
      this.inMemoryVectors = [...(this.inMemoryVectors || []), ...vectors];
    }
  }

  /**
   * Calculate cosine similarity between two vectors (for in-memory fallback)
   * @param {number[]} vecA - First vector
   * @param {number[]} vecB - Second vector
   * @returns {number} - Cosine similarity score
   */
  cosineSimilarity(vecA, vecB) {
    try {
      // Check if vectors are valid
      if (!vecA || !vecB || !Array.isArray(vecA) || !Array.isArray(vecB)) {
        console.error('Invalid vectors provided for similarity calculation');
        return 0;
      }
      
      // Check if vectors have the same length
      if (vecA.length !== vecB.length) {
        console.error(`Vector dimension mismatch: ${vecA.length} vs ${vecB.length}`);
        return 0;
      }
      
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      
      for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
      }
      
      // Avoid division by zero
      if (normA === 0 || normB === 0) {
        console.warn('Zero magnitude vector detected in similarity calculation');
        return 0;
      }
      
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    } catch (error) {
      console.error('Error calculating cosine similarity:', error);
      return 0;
    }
  }

  /**
   * Search the vector database for relevant content
   * @param {string} query - The search query
   * @param {number} topK - Number of top results to return
   * @returns {Promise<string[]>} - Array of relevant text chunks
   */
  async search(query, topK = 5) {
    try {
      console.log(`Searching vector database for query: "${query}"`);
      
      if (!this.vectorSearchAvailable) {
        console.log('Vector search not available, falling back to in-memory search');
        return this.searchInMemory(query, topK);
      }
      
      if (!this.collection) {
        throw new Error('ChromaDB collection not initialized');
      }
      
      if (this.vectorCount === 0) {
        console.log('Vector database is empty');
        return [];
      }
      
      // Generate embedding for query
      console.log('Generating embedding for search query...');
      const queryEmbeddings = await this.generateEmbeddings([query]);
      
      if (!queryEmbeddings || queryEmbeddings.length === 0) {
        console.log('Failed to generate embedding for query, falling back to in-memory search');
        return this.searchInMemory(query, topK);
      }
      
      // Search ChromaDB
      console.log('Searching ChromaDB...');
      const results = await this.collection.query({
        queryEmbeddings: queryEmbeddings,
        nResults: topK
      });
      
      console.log(`Found ${results.documents[0]?.length || 0} results from ChromaDB`);
      return results.documents[0] || [];
    } catch (error) {
      console.error('Error searching vector database:', error);
      
      // Fall back to in-memory search if ChromaDB fails
      console.log('Falling back to in-memory search');
      return this.searchInMemory(query, topK);
    }
  }

  /**
   * Search the in-memory vector store (fallback method)
   * @param {string} query - The search query
   * @param {number} topK - Number of top results to return
   * @returns {Promise<string[]>} - Array of relevant text chunks
   */
  async searchInMemory(query, topK = 5) {
    try {
      console.log(`Searching in-memory vector store for query: "${query}"`);
      
      if (!this.inMemoryVectors || this.inMemoryVectors.length === 0) {
        console.log('In-memory vector store is empty');
        return [];
      }
      
      // Generate embedding for query
      console.log('Generating embedding for search query...');
      const queryEmbeddings = await this.generateSimpleEmbeddings([query]);
      
      if (!queryEmbeddings || queryEmbeddings.length === 0 || !queryEmbeddings[0]) {
        console.log('Failed to generate embedding for query');
        return [];
      }
      
      const queryEmbedding = queryEmbeddings[0];
      
      // Calculate similarity scores
      console.log(`Calculating similarity scores for ${this.inMemoryVectors.length} vectors...`);
      const scoredResults = this.inMemoryVectors.map(item => ({
        text: item.text,
        score: this.cosineSimilarity(queryEmbedding, item.embedding)
      }));
      
      // Sort by similarity score and take top results
      const topResults = scoredResults
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(item => item.text);
      
      console.log(`Found ${topResults.length} relevant results from in-memory search`);
      return topResults;
    } catch (error) {
      console.error('Error searching in-memory vector store:', error);
      return [];
    }
  }

  /**
   * Check if vector search is available
   * @returns {boolean} - Whether vector search is available
   */
  isAvailable() {
    return this.vectorSearchAvailable || (this.inMemoryVectors && this.inMemoryVectors.length > 0);
  }

  /**
   * Get the count of vectors in the store
   * @returns {number} - Number of vectors
   */
  getVectorCount() {
    return this.vectorCount || (this.inMemoryVectors ? this.inMemoryVectors.length : 0);
  }
}

// Export as singleton
module.exports = new VectorSearchService();
