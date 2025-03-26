const axios = require('axios');
const pdfParse = require('pdf-parse');
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
  async processPDFForVectorDB(pdfBuffer) {
    try {
      // Parse PDF
      const pdfData = await pdfParse(pdfBuffer);
      const text = pdfData.text;
      
      // Split text into chunks (paragraphs)
      const chunks = this.splitTextIntoChunks(text);
      
      // Skip if we already have vectors
      if (VectorSearchService.getVectorCount() > 0) {
        console.log('Vector store already populated, skipping insertion');
        return true;
      }
      
      if (chunks.length > 0) {
        console.log(`Adding ${chunks.length} chunks to vector store...`);
        
        // Process chunks in batches to avoid overwhelming the API
        const batchSize = 10;
        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize);
          try {
            // Generate embeddings for this batch
            const embeddings = await VectorSearchService.generateEmbeddings(batch);
            
            // Store chunks with their embeddings
            const vectors = batch.map((text, j) => ({
              id: `chunk-${i + j}`,
              text,
              embedding: embeddings[j]
            }));
            
            VectorSearchService.addVectors(vectors);
            
            console.log(`Processed batch ${i / batchSize + 1}/${Math.ceil(chunks.length / batchSize)}`);
          } catch (error) {
            console.error(`Error processing batch ${i / batchSize + 1}:`, error);
            // Continue with next batch
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error processing PDF for vector database:', error);
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
