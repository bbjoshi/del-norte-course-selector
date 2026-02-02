const axios = require('axios');
const crypto = require('crypto');

/**
 * Service for handling vector search operations
 */
class VectorSearchService {
  /**
   * Initialize the vector search service
   */
  constructor() {
    this.inMemoryVectors = [];
    this.vectorSearchAvailable = false;
    this.embeddingsCache = new Map(); // Cache for storing embeddings
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.retryCount = 0;
    
    // Load cache from file if it exists
    this.loadCache();
  }

  /**
   * Create a hash of the text for caching purposes
   * @param {string} text - Text to hash
   * @returns {string} - Hash of the text
   */
  hashText(text) {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  /**
   * Load embeddings cache from file if it exists
   * This is called automatically in the constructor
   */
  loadCache() {
    try {
      const fs = require('fs');
      const path = require('path');
      const cachePath = path.join(__dirname, '..', '..', 'embeddings-cache.json');
      
      if (fs.existsSync(cachePath)) {
        const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        
        // Convert the object back to a Map
        this.embeddingsCache = new Map(Object.entries(cacheData.embeddings || {}));
        this.cacheHits = cacheData.stats?.hits || 0;
        this.cacheMisses = cacheData.stats?.misses || 0;
        
        console.log(`Loaded embeddings cache with ${this.embeddingsCache.size} entries`);
        return true;
      }
    } catch (error) {
      console.warn('Failed to load embeddings cache:', error.message);
    }
    return false;
  }

  /**
   * Save embeddings cache to file
   * This is called automatically after adding new embeddings
   */
  saveCache() {
    try {
      const fs = require('fs');
      const path = require('path');
      const cachePath = path.join(__dirname, '..', '..', 'embeddings-cache.json');
      
      // Convert the Map to an object for JSON serialization
      const cacheObject = {
        embeddings: Object.fromEntries(this.embeddingsCache),
        stats: {
          hits: this.cacheHits,
          misses: this.cacheMisses,
          timestamp: new Date().toISOString()
        }
      };
      
      fs.writeFileSync(cachePath, JSON.stringify(cacheObject, null, 2));
      console.log(`Saved embeddings cache with ${this.embeddingsCache.size} entries`);
      return true;
    } catch (error) {
      console.warn('Failed to save embeddings cache:', error.message);
      return false;
    }
  }

  /**
   * Generate embeddings using Claude via OpenRouter's chat completions API
   * @param {string[]} texts - Array of text chunks to generate embeddings for
   * @returns {Promise<number[][]>} - Array of embedding vectors
   */
  async generateEmbeddings(texts) {
    try {
      console.log('Generating embeddings for', texts.length, 'text chunks');
      console.log('Using API key:', process.env.REACT_APP_OPENROUTER_API_KEY ? 'Available' : 'Not available');
      
      // Validate input
      if (!texts || !Array.isArray(texts) || texts.length === 0) {
        console.error('Invalid input for embeddings generation: empty or non-array input');
        return [];
      }
      
      // Validate API key
      if (!process.env.REACT_APP_OPENROUTER_API_KEY) {
        console.error('OpenRouter API key is missing');
        return [];
      }

      // Check cache for existing embeddings
      const cacheKeys = texts.map(text => this.hashText(text));
      const cachedResults = cacheKeys.map(key => this.embeddingsCache.get(key));
      
      // If all texts are in cache, return cached embeddings
      if (cachedResults.every(result => result !== undefined)) {
        this.cacheHits += texts.length;
        console.log(`Cache hit! Using ${texts.length} cached embeddings. Total hits: ${this.cacheHits}`);
        return cachedResults;
      }
      
      // Identify which texts need embeddings generated
      const textsToProcess = texts.filter((_, i) => cachedResults[i] === undefined);
      if (textsToProcess.length < texts.length) {
        console.log(`Cache partial hit. Generating embeddings for ${textsToProcess.length} of ${texts.length} texts`);
      } else {
        console.log('Cache miss. Generating embeddings for all texts');
      }
      this.cacheMisses += textsToProcess.length;
      
      // If all embeddings were in cache, return them
      if (textsToProcess.length === 0) {
        return cachedResults;
      }
      
      // Prepare for API request
      console.log('Making request to OpenRouter API...');
      const startTime = Date.now();
      
      // Use Claude to generate embeddings via chat completions API
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'anthropic/claude-3-haiku:20240307',
          messages: [
            { 
              role: 'system', 
              content: 'You are a specialized AI that generates semantic vector embeddings for text. ' +
                'For each input text, create a numerical vector representation that captures its semantic meaning. ' +
                '\n\n' +
                'IMPORTANT: Respond ONLY with a JSON array of embeddings. Each embedding should be an array of 100 floating point numbers between -1 and 1. ' +
                'Format your response as valid JSON that can be parsed with JSON.parse().' +
                '\n\n' +
                'Example response format:\n' +
                '```json\n' +
                '[\n' +
                '  [0.1, 0.2, 0.3, ...],  // embedding for first text\n' +
                '  [0.2, 0.3, 0.4, ...],  // embedding for second text (if multiple texts provided)\n' +
                '  ...\n' +
                ']\n' +
                '```\n\n' +
                'Do not include any explanations or other text outside the JSON.'
            },
            { 
              role: 'user', 
              content: 'Generate semantic vector embeddings for the following text(s). Return ONLY a JSON array of embeddings:\n\n' +
                textsToProcess.join('\n\n---\n\n')
            }
          ],
          user: 'del-norte-course-selector'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://del-norte-course-selector.vercel.app',
            'X-Title': 'Del Norte Course Selector'
          },
          timeout: 30000 // 30 second timeout
        }
      );
      
      const requestDuration = Date.now() - startTime;
      console.log(`OpenRouter API request completed in ${requestDuration}ms`);
      
      // Log rate limit information if available
      if (response.headers && response.headers['x-ratelimit-remaining']) {
        console.log('Rate limit remaining:', response.headers['x-ratelimit-remaining']);
        console.log('Rate limit reset:', response.headers['x-ratelimit-reset']);
      }
      
      if (!response.data) {
        console.error('Empty response from OpenRouter API');
        return [];
      }
      
      if (!response.data.choices || !Array.isArray(response.data.choices) || response.data.choices.length === 0) {
        console.error('Invalid response format from OpenRouter API:', JSON.stringify(response.data));
        return [];
      }
      
      // Request Claude to generate semantic feature vectors for each text
      const content = response.data.choices[0].message.content;
      
      // Try to parse the response as JSON
      let generatedEmbeddings = [];
      
      try {
        // Look for JSON-like content in the response
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                          content.match(/\{[\s\S]*"vectors"[\s\S]*\}/) ||
                          content.match(/\[[\s\S]*\]/);
                          
        if (jsonMatch) {
          try {
            // Try to parse the JSON content
            const jsonContent = jsonMatch[1] || jsonMatch[0];
            const parsed = JSON.parse(jsonContent);
            
            if (Array.isArray(parsed)) {
              generatedEmbeddings = parsed;
            } else if (parsed.vectors && Array.isArray(parsed.vectors)) {
              generatedEmbeddings = parsed.vectors;
            } else if (parsed.embeddings && Array.isArray(parsed.embeddings)) {
              generatedEmbeddings = parsed.embeddings;
            }
          } catch (parseError) {
            console.warn('Failed to parse JSON from Claude response:', parseError.message);
          }
        }
        
        if (generatedEmbeddings.length > 0) {
          console.log('Successfully parsed structured embeddings from Claude response');
        } else {
          throw new Error('Could not parse embeddings from Claude response');
        }
      } catch (structuredParseError) {
        console.warn('Error processing structured response:', structuredParseError.message);
        
        // Fallback: Generate semantic embeddings using TF-IDF inspired approach
        console.log('Falling back to TF-IDF inspired embedding generation');
        
        // Split the content into sentences and words for analysis
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const allWords = content.toLowerCase().split(/\W+/).filter(w => w.length > 2);
        
        // Count word frequencies
        const wordFreq = {};
        allWords.forEach(word => {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        });
        
        // Generate embeddings for each input text
        generatedEmbeddings = textsToProcess.map(text => {
          // Split the text into words
          const textWords = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
          
          // Create a feature vector based on word importance
          const vector = [];
          
          // Add word frequency features
          Object.keys(wordFreq).slice(0, 100).forEach(word => {
            const count = textWords.filter(w => w === word).length;
            const tf = count / Math.max(1, textWords.length); // Term frequency
            const idf = Math.log(sentences.length / Math.max(1, sentences.filter(s => s.includes(word)).length)); // Inverse document frequency
            vector.push(tf * idf);
          });
          
          // Add text length features
          vector.push(text.length / 1000); // Normalized text length
          vector.push(textWords.length / 100); // Normalized word count
          
          // Add character distribution features
          const charCounts = {};
          for (const char of text) {
            charCounts[char] = (charCounts[char] || 0) + 1;
          }
          
          // Add the 10 most common characters as features
          const sortedChars = Object.entries(charCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
            
          sortedChars.forEach(([_, count]) => {
            vector.push(count / text.length);
          });
          
          // Ensure vector has at least 100 dimensions by padding with zeros
          while (vector.length < 100) {
            vector.push(0);
          }
          
          return vector;
        });
      }
      
      // Store new embeddings in cache
      textsToProcess.forEach((text, i) => {
        if (i < generatedEmbeddings.length) {
          const key = this.hashText(text);
          this.embeddingsCache.set(key, generatedEmbeddings[i]);
        }
      });
      
      // Save cache to file
      this.saveCache();
      
      // Combine cached and newly generated embeddings
      const finalEmbeddings = texts.map((text, i) => {
        if (cachedResults[i] !== undefined) {
          return cachedResults[i];
        } else {
          const index = textsToProcess.indexOf(text);
          return index < generatedEmbeddings.length ? generatedEmbeddings[index] : [];
        }
      });
      
      if (finalEmbeddings.length !== texts.length) {
        console.warn(`Warning: Received ${finalEmbeddings.length} embeddings for ${texts.length} input texts`);
      }
      
      console.log('Successfully generated', finalEmbeddings.length, 'embeddings');
      
      // Log a sample embedding to verify format
      if (finalEmbeddings.length > 0) {
        console.log('Sample embedding length:', finalEmbeddings[0].length);
        console.log('Sample embedding first 5 values:', finalEmbeddings[0].slice(0, 5));
      }
      
      // Reset retry count after successful request
      this.retryCount = 0;
      
      return finalEmbeddings;
    } catch (error) {
      console.error('Error generating embeddings:', error.message);
      
      // Enhanced error handling with exponential backoff for rate limiting
      if (error.response && error.response.status === 429) {
        console.log('Rate limit exceeded. Implementing backoff strategy...');
        
        // Implement exponential backoff
        const retryAfter = parseInt(error.response.headers['retry-after'] || '1', 10);
        const waitTime = Math.min(Math.pow(2, this.retryCount || 0) * 1000, 30000); // Max 30 seconds
        
        console.log(`Waiting ${waitTime}ms before retrying...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Increment retry count for exponential backoff
        this.retryCount = (this.retryCount || 0) + 1;
        
        // Retry with reduced batch size if possible
        if (texts.length > 1) {
          console.log('Retrying with smaller batch size...');
          const halfLength = Math.ceil(texts.length / 2);
          const firstHalf = await this.generateEmbeddings(texts.slice(0, halfLength));
          const secondHalf = await this.generateEmbeddings(texts.slice(halfLength));
          return [...firstHalf, ...secondHalf];
        }
        
        // If we can't reduce batch size further, retry the same request
        return this.generateEmbeddings(texts);
      }
      
      // Enhanced error logging
      if (error.code === 'ECONNABORTED') {
        console.error('Request timed out. Consider increasing the timeout value.');
      }
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response headers:', JSON.stringify(error.response.headers));
        console.error('Response data:', JSON.stringify(error.response.data));
        
        // Handle specific error codes
        if (error.response.status === 401 || error.response.status === 403) {
          console.error('Authentication error. Check API key validity and permissions.');
        } else if (error.response.status === 404) {
          console.error('Model not found. Verify the model name is correct.');
        }
      } else if (error.request) {
        console.error('No response received:', error.request);
      }
      
      // Reset retry count after handling the error
      this.retryCount = 0;
      
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
    // Filter out vectors with missing or invalid embeddings
    const validVectors = vectors.filter(v => v.embedding && Array.isArray(v.embedding) && v.embedding.length > 0);
    
    if (validVectors.length !== vectors.length) {
      console.warn(`Filtered out ${vectors.length - validVectors.length} vectors with missing or invalid embeddings`);
    }
    
    if (validVectors.length === 0) {
      console.warn('No valid vectors to add');
      return;
    }
    
    this.inMemoryVectors = [...this.inMemoryVectors, ...validVectors];
    this.vectorSearchAvailable = this.inMemoryVectors.length > 0;
    console.log(`Successfully added ${validVectors.length} vectors to in-memory store. Total: ${this.inMemoryVectors.length}`);
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
        console.log('Vector search not available, vectors count:', this.inMemoryVectors.length);
        return [];
      }
      
      console.log(`Performing vector search for query: "${query}"`);
      
      // Generate embedding for the query
      const queryEmbeddings = await this.generateEmbeddings([query]);
      
      if (!queryEmbeddings || queryEmbeddings.length === 0 || !queryEmbeddings[0]) {
        console.error('Failed to generate query embedding');
        return [];
      }
      
      const queryEmbedding = queryEmbeddings[0];
      console.log('Query embedding generated, length:', queryEmbedding.length);
      
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
      
      console.log(`Found ${topResults.length} results from vector search`);
      return topResults;
    } catch (error) {
      console.error('Error searching vector database:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
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

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  getCacheStats() {
    return {
      cacheSize: this.embeddingsCache.size,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
    };
  }

  /**
   * Clear the embeddings cache
   */
  clearCache() {
    const cacheSize = this.embeddingsCache.size;
    this.embeddingsCache.clear();
    console.log(`Cleared embeddings cache (${cacheSize} entries)`);
    return cacheSize;
  }

  /**
   * Clear all vectors from the in-memory store
   */
  clearVectors() {
    const vectorCount = this.inMemoryVectors.length;
    this.inMemoryVectors = [];
    this.vectorSearchAvailable = false;
    console.log(`Cleared ${vectorCount} vectors from in-memory store`);
    return vectorCount;
  }
}

// Export as singleton
module.exports = new VectorSearchService();
