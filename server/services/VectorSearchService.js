const axios = require('axios');

/**
 * Service for handling vector search operations
 */
class VectorSearchService {
  constructor() {
    this.inMemoryVectors = [];
    this.vectorSearchAvailable = false;
  }

  /**
   * Generate embeddings using OpenRouter (Claude)
   * @param {string[]} texts - Array of text chunks to generate embeddings for
   * @returns {Promise<number[][]>} - Array of embedding vectors
   */
  async generateEmbeddings(texts) {
    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/embeddings',
        {
          model: 'openai/text-embedding-ada-002',
          input: texts
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://del-norte-course-selector.vercel.app',
            'X-Title': 'Del Norte Course Selector'
          }
        }
      );
      
      return response.data.data.map(item => item.embedding);
    } catch (error) {
      console.error('Error generating embeddings:', error);
      // Return empty array to gracefully degrade to traditional search
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {number[]} vecA - First vector
   * @param {number[]} vecB - Second vector
   * @returns {number} - Cosine similarity score
   */
  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Add vectors to the in-memory vector store
   * @param {Array<{id: string, text: string, embedding: number[]}>} vectors - Vectors to add
   */
  addVectors(vectors) {
    this.inMemoryVectors = [...this.inMemoryVectors, ...vectors];
    this.vectorSearchAvailable = this.inMemoryVectors.length > 0;
    console.log(`Successfully added vectors to in-memory store. Total: ${this.inMemoryVectors.length}`);
  }

  /**
   * Search the vector database for relevant content
   * @param {string} query - The search query
   * @param {number} topK - Number of top results to return
   * @returns {Promise<string[]>} - Array of relevant text chunks
   */
  async search(query, topK = 5) {
    try {
      if (!this.vectorSearchAvailable || this.inMemoryVectors.length === 0) {
        console.log('Vector search not available');
        return [];
      }
      
      // Generate embedding for the query
      const queryEmbeddings = await this.generateEmbeddings([query]);
      const queryEmbedding = queryEmbeddings[0];
      
      // Calculate similarity scores
      const scoredResults = this.inMemoryVectors.map(item => ({
        text: item.text,
        score: this.cosineSimilarity(queryEmbedding, item.embedding)
      }));
      
      // Sort by similarity score and take top results
      const topResults = scoredResults
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(item => item.text);
      
      return topResults;
    } catch (error) {
      console.error('Error searching vector database:', error);
      return [];
    }
  }

  /**
   * Check if vector search is available
   * @returns {boolean} - Whether vector search is available
   */
  isAvailable() {
    return this.vectorSearchAvailable;
  }

  /**
   * Get the count of vectors in the store
   * @returns {number} - Number of vectors
   */
  getVectorCount() {
    return this.inMemoryVectors.length;
  }
}

// Export as singleton
module.exports = new VectorSearchService();
