const axios = require('axios');
const { PDFParse: pdfParse } = require('pdf-parse');
const VectorSearchService = require('./VectorSearchService');

/**
 * Service for handling PDF operations
 */
class PDFService {
  constructor() {
    this.pdfContent = null;
    this.courseStructure = {
      math: [],
      science: [],
      english: [],
      languages: [],
      engineering: [],
      electives: []
    };
  }

  /**
   * Split text into chunks with overlap
   * @param {string} text - Text to split
   * @param {number} maxChunkSize - Maximum size of each chunk
   * @param {number} overlap - Overlap between chunks
   * @returns {string[]} - Array of text chunks
   */
  splitTextIntoChunks(text, maxChunkSize = 1000, overlap = 200) {
    // Clean the text
    const cleanedText = text
      .replace(/\s+/g, ' ')
      .trim();
    
    // Split into paragraphs first
    let paragraphs = cleanedText.split(/(?:\r?\n){2,}/);
    paragraphs = paragraphs.filter(p => p.trim().length > 0);
    
    const chunks = [];
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed max size, save current chunk and start a new one
      if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        // Start new chunk with overlap from the end of the previous chunk
        const overlapText = currentChunk.length > overlap 
          ? currentChunk.slice(-overlap) 
          : currentChunk;
        
        currentChunk = overlapText + ' ' + paragraph;
      } else {
        // Add paragraph to current chunk
        if (currentChunk.length > 0) {
          currentChunk += ' ';
        }
        currentChunk += paragraph;
      }
    }
    
    // Add the last chunk if it's not empty
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  /**
   * Process PDF for vector database
   * @param {Buffer} pdfBuffer - PDF buffer
   * @returns {Promise<boolean>} - Success status
   */
  async processPDFForVectorDB(pdfBuffer, documentType = 'unknown') {
    try {
      console.log('Starting PDF processing for vector database...');
      
      // Parse PDF
      const parser = new pdfParse({ data: pdfBuffer });
      const pdfData = await parser.getText();
      const text = pdfData.text;
      console.log(`Extracted ${text.length} characters from PDF`);
      
      // Split text into chunks (paragraphs)
      const chunks = this.splitTextIntoChunks(text);
      console.log(`Split text into ${chunks.length} chunks`);
      
      if (chunks.length === 0) {
        console.error('No chunks generated from PDF text');
        return false;
      }
      
      console.log(`Adding ${chunks.length} chunks to vector store...`);
      
      // Process chunks in smaller batches to avoid overwhelming the API
      const batchSize = 3; // Further reduced batch size from 5 to 3
      const totalBatches = Math.ceil(chunks.length / batchSize);
      let successfulBatches = 0;
      let failedBatches = 0;
      
      // Implement exponential backoff for retries
      const maxRetries = 3;
      const initialBackoff = 2000; // 2 seconds
      
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const currentBatch = Math.floor(i / batchSize) + 1;
        
        console.log(`Processing batch ${currentBatch}/${totalBatches} (${batch.length} chunks)...`);
        
        let retryCount = 0;
        let success = false;
        
        while (!success && retryCount <= maxRetries) {
          try {
            if (retryCount > 0) {
              const backoffTime = initialBackoff * Math.pow(2, retryCount - 1);
              console.log(`Retry ${retryCount}/${maxRetries} for batch ${currentBatch} after ${backoffTime}ms backoff...`);
              await new Promise(resolve => setTimeout(resolve, backoffTime));
            }
            
            // Generate embeddings for this batch
            const embeddings = await VectorSearchService.generateEmbeddings(batch);
            
            if (!embeddings || embeddings.length === 0) {
              console.error(`No embeddings generated for batch ${currentBatch}`);
              throw new Error('Empty embeddings result');
            }
            
            console.log(`Generated ${embeddings.length} embeddings for batch ${currentBatch}`);
            
            // Store chunks with their embeddings
            const vectors = batch.map((text, j) => {
              if (!embeddings[j]) {
                console.warn(`Missing embedding for chunk ${j} in batch ${currentBatch}`);
                return null;
              }
              
              return {
                id: `chunk-${documentType || 'unknown'}-${i + j}`,
                text,
                embedding: embeddings[j]
              };
            }).filter(v => v !== null); // Filter out null entries
            
            if (vectors.length > 0) {
              VectorSearchService.addVectors(vectors);
              console.log(`Added ${vectors.length} vectors from batch ${currentBatch}`);
              success = true;
              successfulBatches++;
            } else {
              console.warn(`No valid vectors to add from batch ${currentBatch}`);
              throw new Error('No valid vectors generated');
            }
            
          } catch (error) {
            retryCount++;
            console.error(`Error processing batch ${currentBatch} (attempt ${retryCount}/${maxRetries + 1}):`, error.message);
            
            if (error.response) {
              console.error('Response status:', error.response.status);
              console.error('Response data:', JSON.stringify(error.response.data));
              
              // Handle rate limiting specifically
              if (error.response.status === 429) {
                const retryAfter = error.response.headers['retry-after'] || 
                                  error.response.headers['x-ratelimit-reset'] || 
                                  30;
                console.log(`Rate limited. Waiting ${retryAfter} seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
              }
            }
            
            if (retryCount > maxRetries) {
              console.error(`Max retries exceeded for batch ${currentBatch}. Moving to next batch.`);
              failedBatches++;
            }
          }
        }
        
        // Add a longer delay between batches to avoid rate limiting
        // Even if the current batch was successful
        console.log(`Waiting 2000ms before processing next batch...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      const finalVectorCount = VectorSearchService.getVectorCount();
      console.log(`PDF processing completed. Total vectors: ${finalVectorCount}`);
      console.log(`Successful batches: ${successfulBatches}/${totalBatches}, Failed batches: ${failedBatches}/${totalBatches}`);
      
      // Consider the process successful if we have vectors, even if some batches failed
      return finalVectorCount > 0;
    } catch (error) {
      console.error('Error processing PDF for vector database:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response headers:', JSON.stringify(error.response.headers));
        console.error('Response data:', JSON.stringify(error.response.data));
      }
      return false;
    }
  }

  /**
   * Fetch PDF from URL
   * @param {string} url - PDF URL
   * @returns {Promise<Buffer>} - PDF buffer
   */
  async fetchPDF(url) {
    try {
      console.log('Fetching PDF...');
      // Use a default URL if none is provided or if the provided URL is invalid
      const pdfUrl = url || 'https://4.files.edl.io/f7e7/02/04/25/231513-8c9f8c2e-257a-49e3-8c4c-ef249811b38e.pdf';
      
      // Validate URL before making the request
      if (!pdfUrl.startsWith('http://') && !pdfUrl.startsWith('https://')) {
        throw new Error('Invalid URL format');
      }
      
      const response = await axios.get(pdfUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      console.log('PDF fetched successfully');
      return response.data;
    } catch (error) {
      console.error('Error fetching PDF:', error.message);
      throw error;
    }
  }

  /**
   * Store and categorize PDF content
   * @param {string} content - PDF content
   */
  storePDFContent(content) {
    if (!content) {
      throw new Error('No content provided');
    }
    
    // Clean and normalize the text
    const cleanContent = content
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .trim();
    
    this.pdfContent = cleanContent;
    this.categorizeCourses(cleanContent);
    console.log('PDF content stored and categorized, length:', cleanContent.length);
    return true;
  }

  /**
   * Categorize courses from PDF content
   * @param {string} content - PDF content
   */
  categorizeCourses(content) {
    const lines = content.split('\n');
    let currentCategory = '';
    
    lines.forEach(line => {
      if (line.toLowerCase().includes('mathematics')) {
        currentCategory = 'math';
      } else if (line.toLowerCase().includes('science')) {
        currentCategory = 'science';
      } else if (line.toLowerCase().includes('english')) {
        currentCategory = 'english';
      } else if (line.toLowerCase().includes('world language')) {
        currentCategory = 'languages';
      } else if (line.toLowerCase().includes('engineering') || line.toLowerCase().includes('technology')) {
        currentCategory = 'engineering';
      } else if (currentCategory && line.match(/\(\d{6}\)/)) {
        // Line contains a course code
        this.courseStructure[currentCategory].push(line.trim());
      }
    });
  }

  /**
   * Get PDF content
   * @returns {string|null} - PDF content
   */
  getPDFContent() {
    return this.pdfContent;
  }

  /**
   * Get course structure
   * @returns {Object} - Course structure
   */
  getCourseStructure() {
    return this.courseStructure;
  }
}

// Export as singleton
module.exports = new PDFService();
