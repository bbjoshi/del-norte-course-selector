const axios = require('axios');
const crypto = require('crypto');
const DatabaseService = require('./DatabaseService');

/**
 * Service for handling vector search operations
 * Now backed by SQLite for persistent storage
 */
class VectorSearchService {
  constructor() {
    this.inMemoryVectors = [];
    this.vectorSearchAvailable = false;
    this.retryCount = 0;
    
    // Load vectors from database into memory for fast search
    this.loadFromDatabase();
  }

  /**
   * Load vectors and cache from SQLite database
   */
  loadFromDatabase() {
    try {
      const vectors = DatabaseService.getVectors();
      if (vectors.length > 0) {
        this.inMemoryVectors = vectors;
        this.vectorSearchAvailable = true;
        console.log(`Loaded ${vectors.length} vectors from database`);
      } else {
        console.log('No vectors found in database');
      }
      
      const cacheSize = DatabaseService.getCacheSize();
      console.log(`Embeddings cache has ${cacheSize} entries in database`);
    } catch (error) {
      console.error('Error loading from database:', error.message);
    }
  }

  /**
   * Create a hash of the text for caching purposes
   */
  hashText(text) {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  /**
   * Generate embeddings using Claude via OpenRouter's chat completions API
   */
  async generateEmbeddings(texts) {
    try {
      console.log('Generating embeddings for', texts.length, 'text chunks');
      console.log('Using API key:', process.env.REACT_APP_OPENROUTER_API_KEY ? 'Available' : 'Not available');
      
      if (!texts || !Array.isArray(texts) || texts.length === 0) {
        console.error('Invalid input for embeddings generation');
        return [];
      }
      
      if (!process.env.REACT_APP_OPENROUTER_API_KEY) {
        console.error('OpenRouter API key is missing');
        return [];
      }

      // Check database cache for existing embeddings
      const cacheKeys = texts.map(text => this.hashText(text));
      const cachedResults = cacheKeys.map(key => DatabaseService.getCachedEmbedding(key));
      
      // If all texts are in cache, return cached embeddings
      if (cachedResults.every(result => result !== null)) {
        console.log(`Database cache hit! Using ${texts.length} cached embeddings`);
        return cachedResults;
      }
      
      // Identify which texts need embeddings generated
      const textsToProcess = texts.filter((_, i) => cachedResults[i] === null);
      if (textsToProcess.length < texts.length) {
        console.log(`Partial cache hit. Generating embeddings for ${textsToProcess.length} of ${texts.length} texts`);
      } else {
        console.log('Cache miss. Generating embeddings for all texts');
      }
      
      if (textsToProcess.length === 0) {
        return cachedResults;
      }
      
      console.log('Making request to OpenRouter API...');
      const startTime = Date.now();
      
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'anthropic/claude-3-haiku:20240307',
          messages: [
            { 
              role: 'system', 
              content: 'You are a specialized AI that generates semantic vector embeddings for text. ' +
                'For each input text, create a numerical vector representation that captures its semantic meaning. ' +
                '\n\nIMPORTANT: Respond ONLY with a JSON array of embeddings. Each embedding should be an array of 100 floating point numbers between -1 and 1. ' +
                'Format your response as valid JSON that can be parsed with JSON.parse().' +
                '\n\nExample response format:\n```json\n[\n  [0.1, 0.2, 0.3, ...]\n]\n```\nDo not include any explanations or other text outside the JSON.'
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
          timeout: 30000
        }
      );
      
      const requestDuration = Date.now() - startTime;
      console.log(`OpenRouter API request completed in ${requestDuration}ms`);
      
      if (!response.data?.choices?.[0]?.message?.content) {
        console.error('Invalid response from OpenRouter API');
        return [];
      }
      
      const content = response.data.choices[0].message.content;
      let generatedEmbeddings = [];
      
      try {
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                          content.match(/\{[\s\S]*"vectors"[\s\S]*\}/) ||
                          content.match(/\[[\s\S]*\]/);
                          
        if (jsonMatch) {
          const jsonContent = jsonMatch[1] || jsonMatch[0];
          const parsed = JSON.parse(jsonContent);
          
          if (Array.isArray(parsed)) {
            generatedEmbeddings = parsed;
          } else if (parsed.vectors) {
            generatedEmbeddings = parsed.vectors;
          } else if (parsed.embeddings) {
            generatedEmbeddings = parsed.embeddings;
          }
        }
        
        if (generatedEmbeddings.length > 0) {
          console.log('Successfully parsed embeddings from Claude response');
        } else {
          throw new Error('Could not parse embeddings');
        }
      } catch (parseError) {
        console.warn('Falling back to TF-IDF embedding generation');
        generatedEmbeddings = this._generateFallbackEmbeddings(textsToProcess, content);
      }
      
      // Store new embeddings in database cache
      textsToProcess.forEach((text, i) => {
        if (i < generatedEmbeddings.length) {
          const key = this.hashText(text);
          DatabaseService.setCachedEmbedding(key, generatedEmbeddings[i]);
        }
      });
      
      // Combine cached and newly generated embeddings
      const finalEmbeddings = texts.map((text, i) => {
        if (cachedResults[i] !== null) {
          return cachedResults[i];
        }
        const index = textsToProcess.indexOf(text);
        return index < generatedEmbeddings.length ? generatedEmbeddings[index] : [];
      });
      
      console.log('Successfully generated', finalEmbeddings.length, 'embeddings');
      if (finalEmbeddings.length > 0) {
        console.log('Sample embedding length:', finalEmbeddings[0].length);
      }
      
      this.retryCount = 0;
      return finalEmbeddings;
    } catch (error) {
      console.error('Error generating embeddings:', error.message);
      
      if (error.response?.status === 429) {
        const waitTime = Math.min(Math.pow(2, this.retryCount || 0) * 1000, 30000);
        console.log(`Rate limited. Waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.retryCount = (this.retryCount || 0) + 1;
        
        if (texts.length > 1) {
          const halfLength = Math.ceil(texts.length / 2);
          const firstHalf = await this.generateEmbeddings(texts.slice(0, halfLength));
          const secondHalf = await this.generateEmbeddings(texts.slice(halfLength));
          return [...firstHalf, ...secondHalf];
        }
        return this.generateEmbeddings(texts);
      }
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        if (error.response.status === 401 || error.response.status === 403) {
          console.error('Authentication error. Check API key.');
        }
      }
      
      this.retryCount = 0;
      return [];
    }
  }

  /**
   * Fallback embedding generation using TF-IDF approach
   */
  _generateFallbackEmbeddings(texts, content) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const allWords = content.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const wordFreq = {};
    allWords.forEach(word => { wordFreq[word] = (wordFreq[word] || 0) + 1; });
    
    return texts.map(text => {
      const textWords = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
      const vector = [];
      
      Object.keys(wordFreq).slice(0, 100).forEach(word => {
        const count = textWords.filter(w => w === word).length;
        const tf = count / Math.max(1, textWords.length);
        const idf = Math.log(sentences.length / Math.max(1, sentences.filter(s => s.includes(word)).length));
        vector.push(tf * idf);
      });
      
      vector.push(text.length / 1000);
      vector.push(textWords.length / 100);
      
      while (vector.length < 100) vector.push(0);
      return vector;
    });
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA, vecB) {
    const minLen = Math.min(vecA.length, vecB.length);
    let dotProduct = 0, normA = 0, normB = 0;
    
    for (let i = 0; i < minLen; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Add vectors to both in-memory store and database
   */
  addVectors(vectors, documentType = 'unknown') {
    const validVectors = vectors.filter(v => v.embedding && Array.isArray(v.embedding) && v.embedding.length > 0);
    
    if (validVectors.length === 0) {
      console.warn('No valid vectors to add');
      return;
    }
    
    // Add to in-memory store
    this.inMemoryVectors = [...this.inMemoryVectors, ...validVectors];
    this.vectorSearchAvailable = true;
    
    // Persist to database
    try {
      DatabaseService.addVectors(validVectors, documentType);
      console.log(`Persisted ${validVectors.length} vectors to database. Total in-memory: ${this.inMemoryVectors.length}`);
    } catch (error) {
      console.error('Error persisting vectors to database:', error.message);
    }
  }

  /**
   * Search the vector database for relevant content
   */
  async search(query, topK = 5) {
    try {
      if (!this.vectorSearchAvailable || this.inMemoryVectors.length === 0) {
        return [];
      }
      
      console.log(`Performing vector search for query: "${query}"`);
      
      const queryEmbeddings = await this.generateEmbeddings([query]);
      if (!queryEmbeddings?.[0]) {
        console.error('Failed to generate query embedding');
        return [];
      }
      
      const queryEmbedding = queryEmbeddings[0];
      console.log('Query embedding generated, length:', queryEmbedding.length);
      
      const scoredResults = this.inMemoryVectors.map(item => ({
        text: item.text,
        score: this.cosineSimilarity(queryEmbedding, item.embedding)
      }));
      
      const topResults = scoredResults
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(item => item.text);
      
      console.log(`Found ${topResults.length} results from vector search`);
      return topResults;
    } catch (error) {
      console.error('Error searching vector database:', error.message);
      return [];
    }
  }

  isAvailable() { return this.vectorSearchAvailable; }
  getVectorCount() { return this.inMemoryVectors.length; }

  getCacheStats() {
    return {
      cacheSize: DatabaseService.getCacheSize(),
      vectorCount: this.inMemoryVectors.length,
      databaseVectorCount: DatabaseService.getVectorCount(),
    };
  }

  clearCache() {
    return DatabaseService.clearEmbeddingsCache();
  }

  clearVectors() {
    const count = this.inMemoryVectors.length;
    this.inMemoryVectors = [];
    this.vectorSearchAvailable = false;
    DatabaseService.clearVectors();
    console.log(`Cleared ${count} vectors from memory and database`);
    return count;
  }

  /**
   * Check if vectors for a specific document type already exist in the database
   */
  hasVectorsForDocument(documentType) {
    return DatabaseService.hasVectorsForDocument(documentType);
  }
}

module.exports = new VectorSearchService();
