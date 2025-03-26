const express = require('express');
const router = express.Router();
const PDFService = require('../services/PDFService');
const VectorSearchService = require('../services/VectorSearchService');
const SearchService = require('../services/SearchService');
const ChatService = require('../services/ChatService');

/**
 * @route GET /api/pdf
 * @desc Fetch and serve PDF
 */
router.get('/pdf', async (req, res) => {
  try {
    console.log('Fetching PDF...');
    // Get PDF URL from query parameter, environment variable, or use default
    let pdfUrl = req.query.url || process.env.PDF_URL || 'https://4.files.edl.io/f7e7/02/04/25/231513-8c9f8c2e-257a-49e3-8c4c-ef249811b38e.pdf';
    
    // Ensure URL is properly formatted
    if (!pdfUrl.startsWith('http://') && !pdfUrl.startsWith('https://')) {
      console.log(`Invalid URL format: ${pdfUrl}, using default URL`);
      pdfUrl = 'https://4.files.edl.io/f7e7/02/04/25/231513-8c9f8c2e-257a-49e3-8c4c-ef249811b38e.pdf';
    }
    
    console.log(`Using PDF URL: ${pdfUrl}`);
    const pdfBuffer = await PDFService.fetchPDF(pdfUrl);
    
    // Process PDF for vector database in the background
    PDFService.processPDFForVectorDB(pdfBuffer).then(success => {
      console.log(`PDF processing for vector search ${success ? 'completed' : 'failed'}`);
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error fetching PDF:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
    res.status(500).json({ error: 'Failed to fetch PDF', details: error.message });
  }
});

/**
 * @route POST /api/pdf/content
 * @desc Store PDF content
 */
router.post('/pdf/content', (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'No content provided' });
    }
    
    PDFService.storePDFContent(content);
    res.json({ success: true });
  } catch (error) {
    console.error('Error storing PDF content:', error);
    res.status(500).json({ error: 'Failed to store PDF content' });
  }
});

/**
 * @route GET /api/pdf/search
 * @desc Search PDF content
 */
router.get('/pdf/search', (req, res) => {
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

/**
 * @route POST /api/chat
 * @desc Process chat query
 */
router.post('/chat', async (req, res) => {
  try {
    // Get conversation history from the request
    let conversationHistory = req.body.messages || [];
    
    // Get the latest user query (the last user message in the conversation)
    const userMessages = conversationHistory.filter(msg => msg.role === 'user');
    const userQuery = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';
    
    if (!userQuery) {
      throw new Error('No user query found in the conversation history');
    }
    
    // Process the query
    const assistantResponse = await ChatService.processQuery(conversationHistory, userQuery);
    
    // Format the response to match OpenRouter API
    const transformedResponse = {
      choices: [
        {
          message: {
            content: assistantResponse,
            role: 'assistant'
          }
        }
      ]
    };
    
    res.json(transformedResponse);
  } catch (error) {
    console.error('Error processing chat query:', error);
    res.status(500).json({ 
      error: 'Failed to process chat query',
      details: error.message
    });
  }
});

/**
 * @route POST /api/summarize
 * @desc Summarize conversation
 */
router.post('/summarize', async (req, res) => {
  try {
    const messages = req.body.messages || [];
    if (messages.length === 0) {
      throw new Error('No messages provided for summarization');
    }

    const summary = await ChatService.summarizeConversation(messages);
    
    // Format the response to match OpenRouter API
    const transformedResponse = {
      choices: [
        {
          message: {
            content: summary,
            role: 'assistant'
          }
        }
      ]
    };
    
    res.json(transformedResponse);
  } catch (error) {
    console.error('Error summarizing conversation:', error);
    res.status(500).json({ 
      error: 'Failed to summarize conversation',
      details: error.message
    });
  }
});

/**
 * @route GET /api/vector-search
 * @desc Search vector database
 */
router.get('/vector-search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'No search query provided' });
    }
    
    const results = await VectorSearchService.search(query, 5);
    res.json({ results });
  } catch (error) {
    console.error('Error searching vector database:', error);
    res.status(500).json({ error: 'Failed to search vector database' });
  }
});

/**
 * @route GET /health
 * @desc Health check endpoint
 */
router.get('/health', (req, res) => {
  const pdfContent = PDFService.getPDFContent();
  const courseStructure = PDFService.getCourseStructure();
  
  res.json({ 
    status: 'ok',
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

/**
 * @route GET /debug/pdf-status
 * @desc Debug endpoint to check PDF processing status
 */
router.get('/debug/pdf-status', (req, res) => {
  const pdfContent = PDFService.getPDFContent();
  const courseStructure = PDFService.getCourseStructure();
  
  res.json({
    pdfContentAvailable: !!pdfContent,
    pdfContentLength: pdfContent ? pdfContent.length : 0,
    vectorSearchAvailable: VectorSearchService.isAvailable(),
    vectorCount: VectorSearchService.getVectorCount(),
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

module.exports = router;
