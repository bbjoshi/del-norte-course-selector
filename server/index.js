const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');const fs = require('fs');
const { PDFParse: pdfParse } = require('pdf-parse');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const port = process.env.PORT || 3003;

const VectorSearchService = require('./services/VectorSearchService');
const PDFService = require('./services/PDFService');
const SearchService = require('./services/SearchService');
const ChatService = require('./services/ChatService');

// Flags to track embedding generation status
let embeddingsGenerationInProgress = false;
let embeddingsGenerationComplete = false;
let embeddingsGenerationError = null;
let embeddingsGenerationProgress = 0;

// Store PDF content in memory
let pdfContent = null;
let courseStructure = {
  math: [],
  science: [],
  english: [],
  languages: [],
  engineering: [],
  electives: []
};

// Function to process PDF and add to vector store
async function processPDFForVectorDB(pdfBuffer) {
  try {
    // Set flags to indicate processing has started
    embeddingsGenerationInProgress = true;
    embeddingsGenerationComplete = false;
    embeddingsGenerationError = null;
    embeddingsGenerationProgress = 0;
    
    console.log('Starting PDF processing for embeddings generation...');
    
    // Extract text from PDF to get total chunks for progress calculation
    const parser = new pdfParse({ data: Buffer.from(pdfBuffer) });
    const pdfData = await parser.getText();
    const text = pdfData.text;
    const chunks = PDFService.splitTextIntoChunks(text);
    const totalChunks = chunks.length;
    
    console.log(`Starting embeddings generation for ${totalChunks} chunks...`);
    
    // Set up progress monitoring by wrapping addVectors
    let processedChunks = 0;
    const originalAddVectors = VectorSearchService.addVectors.bind(VectorSearchService);
    
    // Override addVectors to track progress
    VectorSearchService.addVectors = (vectors) => {
      const result = originalAddVectors(vectors);
      processedChunks += vectors.length;
      embeddingsGenerationProgress = Math.min(Math.round((processedChunks / totalChunks) * 100), 100);
      console.log(`Embeddings generation progress: ${embeddingsGenerationProgress}% (${processedChunks}/${totalChunks} chunks)`);
      return result;
    };
    
    try {
      // Use PDFService to process the PDF
      const success = await PDFService.processPDFForVectorDB(pdfBuffer);
      
      // Update flags based on result
      embeddingsGenerationComplete = true;
      embeddingsGenerationInProgress = false;
      embeddingsGenerationProgress = 100;
      
      if (!success) {
        embeddingsGenerationError = "PDF processing completed but no vectors were generated";
        console.error(embeddingsGenerationError);
      } else {
        console.log(`Successfully generated embeddings for ${VectorSearchService.getVectorCount()} chunks`);
      }
      
      return success;
    } finally {
      // Always restore original function
      VectorSearchService.addVectors = originalAddVectors;
    }
  } catch (error) {
    console.error('Error processing PDF for vector database:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    embeddingsGenerationError = error.message;
    embeddingsGenerationComplete = false;
    embeddingsGenerationInProgress = false;
    
    // Log detailed error information
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', JSON.stringify(error.response.headers));
      console.error('Response data:', JSON.stringify(error.response.data));
    }
    
    return false;
  }
}

// Enable CORS for production and development
app.use(cors({
  origin: [
    'https://del-norte-course-selector.vercel.app',
    'https://del-norte-course-selector.herokuapp.com',
    'https://del-norte-course-selector.onrender.com',
    'http://localhost:3002',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST'],
  credentials: true
}));

// Increase payload limit to 50mb
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from the React build
app.use(express.static(path.join(__dirname, '..', 'build')));

// Import and use admin routes
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);


// PDF proxy endpoint
app.get('/api/pdf', async (req, res) => {
  try {
    console.log('Fetching PDF...');
    const pdfUrl = process.env.PDF_URL || 'https://4.files.edl.io/f7e7/02/04/25/231513-8c9f8c2e-257a-49e3-8c4c-ef249811b38e.pdf';
    
    console.log(`Attempting to fetch PDF from URL: ${pdfUrl}`);
    
    // Add timeout to prevent hanging requests
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 30000 // 30 second timeout
    });
    
    console.log('PDF fetched successfully');
    
    // Verify we have valid PDF data
    if (!response.data || response.data.length === 0) {
      throw new Error('Received empty PDF data');
    }
    
    // Process PDF for vector database
    // Use a try/catch to prevent processing errors from affecting the response
    try {
      // Start processing in the background
      processPDFForVectorDB(response.data).then(success => {
        console.log(`PDF processing for vector search ${success ? 'completed' : 'failed'}`);
      }).catch(err => {
        console.error('Background PDF processing error:', err);
        embeddingsGenerationError = err.message;
        embeddingsGenerationInProgress = false;
      });
    } catch (processingError) {
      console.error('Error starting PDF processing:', processingError);
      embeddingsGenerationError = processingError.message;
      embeddingsGenerationInProgress = false;
      // Continue with the response even if background processing fails
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.send(response.data);
  } catch (error) {
    console.error('Error fetching PDF:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    res.status(500).json({ error: 'Failed to fetch PDF', details: error.message });
  }
});

// Store PDF content endpoint
app.post('/api/pdf/content', (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'No content provided' });
    }
    
    // Use PDFService to store and categorize the content
    PDFService.storePDFContent(content);
    console.log('PDF content stored and categorized');
    res.json({ success: true });
  } catch (error) {
    console.error('Error storing PDF content:', error);
    res.status(500).json({ error: 'Failed to store PDF content' });
  }
});

// Helper function to safely create regex patterns
function createSearchPatterns(query) {
  const patterns = [];
  
  // Helper function to safely create a regex pattern
  const safeRegex = (pattern) => {
    try {
      // Escape special regex characters
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(escaped, 'i');
    } catch (error) {
      console.warn('Invalid regex pattern:', pattern);
      return null;
    }
  };

  // Add patterns for academic planning
  if (query.match(/plan|schedule|pathway/i)) {
    patterns.push(
      safeRegex('year'),
      safeRegex('grade'),
      safeRegex('prerequisite'),
      safeRegex('requirement'),
      safeRegex('recommended'),
      safeRegex('pathway')
    );
  }

  // Add patterns for specific subjects
  if (query.match(/math|calculus|algebra|geometry/i)) {
    patterns.push(
      safeRegex('math'),
      safeRegex('mathematics'),
      safeRegex('algebra'),
      safeRegex('geometry'),
      safeRegex('calculus'),
      safeRegex('integrated'),
      safeRegex('prerequisite')
    );
  }

  if (query.match(/science|physics|chemistry|biology/i)) {
    patterns.push(
      safeRegex('science'),
      safeRegex('physics'),
      safeRegex('chemistry'),
      safeRegex('biology'),
      safeRegex('laboratory')
    );
  }

  if (query.match(/engineering|technology/i)) {
    patterns.push(
      safeRegex('engineering'),
      safeRegex('technology'),
      safeRegex('design'),
      safeRegex('robotics'),
      safeRegex('computer')
    );
  }

  // Add common academic terms
  patterns.push(
    safeRegex('course'),
    safeRegex('class'),
    safeRegex('credit'),
    safeRegex('prerequisite'),
    safeRegex('requirement'),
    safeRegex('advanced placement'),
    safeRegex('honors')
  );

  // Add individual word patterns for words longer than 3 characters
  const words = query.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 3)
    .map(word => safeRegex(word));

  return [...patterns, ...words].filter(Boolean); // Remove any null patterns
}

// Helper function to score paragraph relevance
function scoreParagraph(paragraph, patterns, query) {
  let score = 0;
  const lowerParagraph = paragraph.toLowerCase();
  const queryWords = query.toLowerCase().split(/\s+/);

  // Score based on regex patterns
  patterns.forEach(pattern => {
    const matches = paragraph.match(pattern);
    if (matches) {
      score += matches.length * 2;  // Give more weight to pattern matches
    }
  });

  // Score based on query word proximity
  queryWords.forEach((word, i) => {
    if (word.length > 3 && lowerParagraph.includes(word)) {
      score += 1;
      // Check if next word also appears nearby (within 50 chars)
      if (i < queryWords.length - 1) {
        const nextWord = queryWords[i + 1];
        const wordIndex = lowerParagraph.indexOf(word);
        const nextWordIndex = lowerParagraph.indexOf(nextWord);
        if (nextWordIndex !== -1 && Math.abs(nextWordIndex - wordIndex) < 50) {
          score += 2;  // Bonus for words appearing close together
        }
      }
    }
  });

  // Bonus points for paragraphs containing course codes
  if (paragraph.match(/\(\d{6}\)/)) {
    score += 3;
  }

  return score;
}

// Search PDF content endpoint
app.get('/api/pdf/search', (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'No search query provided' });
  }
  
  const pdfContent = PDFService.getPDFContent();
  if (!pdfContent) {
    return res.status(404).json({ error: 'PDF content not loaded' });
  }

  try {
    const relevantParagraphs = SearchService.search(pdfContent, query);
    console.log(`Found ${relevantParagraphs.length} relevant paragraphs for query: ${query}`);
    res.json({ results: relevantParagraphs });
  } catch (error) {
    console.error('Error searching PDF content:', error);
    res.status(500).json({ error: 'Failed to search PDF content' });
  }
});

// Claude API proxy endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const openRouterApiKey = process.env.REACT_APP_OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      throw new Error('No API key configured for OpenRouter');
    }

    // Get conversation history from the request
    let conversationHistory = req.body.messages || [];
    
    // Define maximum allowed messages to prevent excessively large requests
    const MAX_ALLOWED_MESSAGES = 20;
    
    // Trim conversation history if it exceeds the maximum length
    if (conversationHistory.length > MAX_ALLOWED_MESSAGES) {
      // Keep the first two messages (often contain important context)
      const firstMessages = conversationHistory.slice(0, 2);
      // Keep the most recent messages
      const recentMessages = conversationHistory.slice(-(MAX_ALLOWED_MESSAGES - 2));
      // Combine them to form the new history
      conversationHistory = [...firstMessages, ...recentMessages];
      console.log(`Trimmed conversation history from ${req.body.messages.length} to ${conversationHistory.length} messages`);
    }
    
    // Get the latest user query (the last user message in the conversation)
    const userMessages = conversationHistory.filter(msg => msg.role === 'user');
    const userQuery = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';
    
    if (!userQuery) {
      throw new Error('No user query found in the conversation history');
    }
    
    // Get relevant info from the request or search for it
    let relevantInfo = req.body.relevantInfo || '';
    
    // If no relevant info was provided, search for it
    if (!relevantInfo) {
      // Search vector database for relevant content
      const vectorResults = await VectorSearchService.search(userQuery, 5);
      console.log(`Found ${vectorResults.length} results from vector search`);
      
      // Combine vector search results
      relevantInfo = vectorResults.join('\n\n');
      
      // If vector search didn't return results, fall back to traditional search
      if (!relevantInfo) {
        console.log('Falling back to traditional search...');
        const pdfContent = PDFService.getPDFContent();
        
        if (pdfContent) {
          const relevantParagraphs = SearchService.search(pdfContent, userQuery);
          relevantInfo = relevantParagraphs.join('\n\n');
          
          // Add structured course information for relevant categories
          const courseStructure = PDFService.getCourseStructure();
          if (userQuery.toLowerCase().includes('plan') || userQuery.toLowerCase().includes('pathway')) {
            relevantInfo += '\n\nAvailable courses by category:\n';
            if (courseStructure.math.length > 0) {
              relevantInfo += '\nMathematics:\n' + courseStructure.math.join('\n');
            }
            if (courseStructure.science.length > 0) {
              relevantInfo += '\nScience:\n' + courseStructure.science.join('\n');
            }
            if (courseStructure.engineering.length > 0) {
              relevantInfo += '\nEngineering & Technology:\n' + courseStructure.engineering.join('\n');
            }
          }
          
          if (!relevantInfo) {
            relevantInfo = "I couldn't find any specific information about that in the course catalog.";
          }
        }
      }
    }

    // Prepare the system message with instructions and relevant info
    const systemMessage = {
      role: 'system',
      content: `
        You are a helpful course recommendation assistant for Del Norte High School. Your purpose is to suggest appropriate courses from the school's catalog based on student queries, whether about specific subjects, college majors, or career paths.

        When responding to queries:

        1. Determine the query type:
           - If asking about specific subjects (e.g., "Tell me about AP Chemistry"), provide detailed information about just that course.
           - If asking about a subject area (e.g., "What math courses are available?"), list all relevant courses in that category with brief descriptions.
           - If asking about college majors or careers, map these to relevant high school subject areas (A-Social Science, B-English, C-Mathematics, D-Sciences, E-World Languages, F-Fine Arts, G-Electives).
           - Only generate a comprehensive 4-year plan when explicitly requested (e.g., "Create a 4-year plan for a student interested in engineering").

        2. For subject-specific questions:
           - Provide accurate, detailed information from the catalog about the requested course(s)
           - Include course codes, prerequisites, grade eligibility, and UC/CSU requirement fulfillment
           - Highlight key aspects of the course content and any special requirements

        3. For 4-year plan requests (only when explicitly asked):
           - Organize recommendations by grade level (9-12) with clear headings for each year
           - Suggest 6-8 courses per year that follow logical progression paths
           - Carefully follow prerequisite requirements mentioned in the catalog
           - Ensure all graduation requirements are met while incorporating interest-specific courses
           - Balance course load difficulty appropriately for each grade level

        4. When recommending courses for any purpose:
           - Analyze course sequences and prerequisites to suggest logical progression paths
           - Highlight advanced placement, honors, and specialized courses that align with expressed interests
           - For interests spanning multiple disciplines, include courses from all relevant subject areas
           - Present each recommended course with complete details from the catalog
           - Avoid suggesting courses that do not exist in the catalog
           - Present course codes in the format (123456) and include page numbers for reference

        5. Be conversational and helpful, asking follow-up questions when necessary to better understand the student's specific needs.

        Remember that this catalog is organized by subject areas rather than majors. Avoid inventing courses that don't exist in the catalog, and verify all course codes and details before providing information or recommendations.
        
        Course Catalog Information:
        ${relevantInfo}
        
        IMPORTANT: Maintain context from the conversation history. Reference previous questions and your previous answers when appropriate to provide continuity.
      `
    };

    // Create a new array with the system message followed by the conversation history
    const messages = [systemMessage, ...conversationHistory];

    console.log('Sending request to OpenRouter API with conversation history...');
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3.5-sonnet',
        messages: messages,
        max_tokens: 4000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openRouterApiKey}`,
          'HTTP-Referer': 'https://del-norte-course-selector.vercel.app',
          'X-Title': 'Del Norte Course Selector'
        }
      }
    );
    
    console.log('Received response from OpenRouter');
    
    // OpenRouter already returns in the expected format
    const transformedResponse = response.data;
    
    res.json(transformedResponse);
  } catch (error) {
    console.error('Error calling OpenRouter API:', error);
    res.status(500).json({ 
      error: 'Failed to get response from OpenRouter',
      details: error.message
    });
  }
});

// Summarize conversation endpoint
app.post('/api/summarize', async (req, res) => {
  try {
    const openRouterApiKey = process.env.REACT_APP_OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      throw new Error('No API key configured for OpenRouter');
    }

    const messages = req.body.messages || [];
    if (messages.length === 0) {
      throw new Error('No messages provided for summarization');
    }

    console.log('Summarizing conversation...');
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3-haiku:20240307',  // Using a smaller model for summarization
        messages: messages,
        max_tokens: 1000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openRouterApiKey}`,
          'HTTP-Referer': 'https://del-norte-course-selector.vercel.app',
          'X-Title': 'Del Norte Course Selector'
        }
      }
    );
    
    console.log('Received summarization response');
    res.json(response.data);
  } catch (error) {
    console.error('Error summarizing conversation:', error);
    res.status(500).json({ 
      error: 'Failed to summarize conversation',
      details: error.message
    });
  }
});

// Vector search endpoint
app.get('/api/vector-search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'No search query provided' });
    }
    
    // Check if embeddings generation is still in progress
    if (embeddingsGenerationInProgress) {
      return res.status(202).json({ 
        status: 'processing',
        message: 'Embeddings generation is still in progress',
        progress: embeddingsGenerationProgress
      });
    }
    
    // Check if there was an error during embeddings generation
    if (embeddingsGenerationError) {
      console.warn('Using traditional search due to embeddings generation error:', embeddingsGenerationError);
      return res.status(200).json({ results: [] }); // Return empty results to trigger fallback
    }
    
    const results = await VectorSearchService.search(query, 5);
    res.json({ results });
  } catch (error) {
    console.error('Error searching vector database:', error.message);
    res.status(500).json({ error: 'Failed to search vector database' });
  }
});

// Embeddings status endpoint
app.get('/api/embeddings-status', (req, res) => {
  res.json({
    inProgress: embeddingsGenerationInProgress,
    complete: embeddingsGenerationComplete,
    error: embeddingsGenerationError,
    progress: embeddingsGenerationProgress,
    vectorCount: VectorSearchService.getVectorCount(),
    vectorSearchAvailable: VectorSearchService.isAvailable()
  });
});

// Version endpoint
app.get('/version', (req, res) => {
  const packageJson = require('../package.json');
  res.json({ 
    version: packageJson.version,
    name: packageJson.name
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const packageJson = require('../package.json');
  const pdfContent = PDFService.getPDFContent();
  const courseStructure = PDFService.getCourseStructure();
  
  res.json({ 
    status: 'ok',
    version: packageJson.version,
    hasPdfContent: !!pdfContent,
    hasVectorSearch: VectorSearchService.isAvailable(),
    vectorCount: VectorSearchService.getVectorCount(),
    contentLength: pdfContent ? pdfContent.length : 0,
    courseCounts: {
      math: courseStructure.math.length,
      science: courseStructure.science.length,
      english: courseStructure.english.length,
      languages: courseStructure.languages.length,
      engineering: courseStructure.engineering.length,
      electives: courseStructure.electives.length
    }
  });
});

// Debug endpoint to check PDF processing status
app.get('/debug/pdf-status', (req, res) => {
  const pdfContent = PDFService.getPDFContent();
  const courseStructure = PDFService.getCourseStructure();
  
  res.json({
    pdfContentAvailable: !!pdfContent,
    pdfContentLength: pdfContent ? pdfContent.length : 0,
    vectorSearchAvailable: VectorSearchService.isAvailable(),
    vectorCount: VectorSearchService.getVectorCount(),
    embeddingsGenerationInProgress: embeddingsGenerationInProgress,
    embeddingsGenerationComplete: embeddingsGenerationComplete,
    embeddingsGenerationError: embeddingsGenerationError,
    embeddingsGenerationProgress: embeddingsGenerationProgress,
    vectorSample: VectorSearchService.getVectorCount() > 0 ? [
      {
        id: 'sample-vector',
        text: 'Sample vector text (actual text not shown for brevity)',
        embeddingLength: 'Sample embedding length (actual length not shown for brevity)'
      }
    ] : [],
    courseCounts: {
      math: courseStructure.math.length,
      science: courseStructure.science.length,
      english: courseStructure.english.length,
      languages: courseStructure.languages.length,
      engineering: courseStructure.engineering.length,
      electives: courseStructure.electives.length
    },
    mathSample: courseStructure.math.slice(0, 3),
    scienceSample: courseStructure.science.slice(0, 3)
  });
});

// Serve React app for all other routes (commented out for development with Vite)
// In production, uncomment this to serve the built React app
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '..', 'build', 'index.html'));
// });

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Environment:', {
    nodeEnv: process.env.NODE_ENV,
    port,
    hasApiKey: !!process.env.REACT_APP_OPENROUTER_API_KEY
  });
});
