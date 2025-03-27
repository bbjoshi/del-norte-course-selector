const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const port = process.env.PORT || 3003;

// Flag to indicate if vector search is available
let vectorSearchAvailable = false;

// In-memory vector store as fallback
let inMemoryVectors = [];

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

// Generate embeddings using OpenRouter (OpenAI)
async function generateEmbeddings(texts) {
  try {
    // Create the request payload with proper JSON formatting
    const payload = JSON.stringify({
      model: 'openai/text-embedding-3-small',
      input: texts
    });
    
    const response = await axios.post(
      'https://openrouter.ai/api/v1/embeddings',
      payload,
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

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
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

// Function to split text into chunks
function splitTextIntoChunks(text, maxChunkSize = 1000, overlap = 200) {
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

// Function to process PDF and add to in-memory vector store
async function processPDFForVectorDB(pdfBuffer) {
  try {
    // Parse PDF
    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text;
    
    // Split text into chunks (paragraphs)
    const chunks = splitTextIntoChunks(text);
    
    // Skip if we already have vectors
    if (inMemoryVectors.length > 0) {
      console.log('In-memory vector store already populated, skipping insertion');
      return true;
    }
    
    if (chunks.length > 0) {
      console.log(`Adding ${chunks.length} chunks to in-memory vector store...`);
      
      // Process chunks in batches to avoid overwhelming the API
      const batchSize = 10;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        try {
          // Generate embeddings for this batch
          const embeddings = await generateEmbeddings(batch);
          
          // Store chunks with their embeddings
          for (let j = 0; j < batch.length; j++) {
            inMemoryVectors.push({
              id: `chunk-${i + j}`,
              text: batch[j],
              embedding: embeddings[j]
            });
          }
          
          console.log(`Processed batch ${i / batchSize + 1}/${Math.ceil(chunks.length / batchSize)}`);
        } catch (error) {
          console.error(`Error processing batch ${i / batchSize + 1}:`, error);
          // Continue with next batch
        }
      }
      
      console.log(`Successfully added ${inMemoryVectors.length} vectors to in-memory store`);
      vectorSearchAvailable = inMemoryVectors.length > 0;
    }
    
    return true;
  } catch (error) {
    console.error('Error processing PDF for vector database:', error);
    return false;
  }
}

// Function to search in-memory vector store
async function searchVectorDB(query, topK = 5) {
  try {
    if (!vectorSearchAvailable || inMemoryVectors.length === 0) {
      console.log('Vector search not available');
      return [];
    }
    
    // Generate embedding for the query
    const queryEmbeddings = await generateEmbeddings([query]);
    const queryEmbedding = queryEmbeddings[0];
    
    // Calculate similarity scores
    const scoredResults = inMemoryVectors.map(item => ({
      text: item.text,
      score: cosineSimilarity(queryEmbedding, item.embedding)
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

// Helper function to categorize courses
function categorizeCourses(content) {
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
      courseStructure[currentCategory].push(line.trim());
    }
  });
}

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
    
    // Process PDF for vector database in the background
    // Use a try/catch to prevent background processing errors from affecting the response
    try {
      processPDFForVectorDB(response.data).then(success => {
        console.log(`PDF processing for vector search ${success ? 'completed' : 'failed'}`);
      }).catch(err => {
        console.error('Background PDF processing error:', err);
      });
    } catch (processingError) {
      console.error('Error starting PDF processing:', processingError);
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
    
    // Clean and normalize the text
    const cleanContent = content
      .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
      .trim();
    
    pdfContent = cleanContent;
    categorizeCourses(cleanContent);
    console.log('PDF content stored and categorized, length:', cleanContent.length);
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
  
  if (!pdfContent) {
    return res.status(404).json({ error: 'PDF content not loaded' });
  }

  try {
    // Split content into paragraphs and clean them
    const paragraphs = pdfContent
      .split(/[.!?]\s+/)  // Split on sentence boundaries
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // Create search patterns
    const patterns = createSearchPatterns(query);
    console.log('Search patterns:', patterns.map(p => p.toString()));

    // Search for relevant paragraphs with scoring
    const scoredParagraphs = paragraphs.map(paragraph => ({
      text: paragraph,
      score: scoreParagraph(paragraph, patterns, query)
    }));

    // Sort by relevance score and take top results
    const relevantParagraphs = scoredParagraphs
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)  // Take top 15 most relevant paragraphs
      .map(p => p.text);

    console.log(`Found ${relevantParagraphs.length} relevant paragraphs for query: ${query}`);

    // If no results, try a more lenient search
    if (relevantParagraphs.length === 0) {
      const queryWords = query.toLowerCase().split(/\s+/);
      const lenientResults = paragraphs.filter(p => {
        const paragraphWords = p.toLowerCase().split(/\s+/);
        return queryWords.some(word => 
          word.length > 3 && paragraphWords.some(pWord => pWord.includes(word))
        );
      }).slice(0, 8);  // Take top 8 results from lenient search

      if (lenientResults.length > 0) {
        console.log('Found results with lenient search');
        return res.json({ results: lenientResults });
      }
    }

    res.json({ results: relevantParagraphs });
  } catch (error) {
    console.error('Error searching PDF content:', error);
    res.status(500).json({ error: 'Failed to search PDF content' });
  }
});

// Claude API proxy endpoint
app.post('/api/chat', async (req, res) => {
  try {
    if (!process.env.REACT_APP_OPENROUTER_API_KEY) {
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
      const vectorResults = await searchVectorDB(userQuery, 5);
      console.log(`Found ${vectorResults.length} results from vector search`);
      
      // Combine vector search results
      relevantInfo = vectorResults.join('\n\n');
      
      // If vector search didn't return results, fall back to traditional search
      if (!relevantInfo && pdfContent) {
        console.log('Falling back to traditional search...');
        
        // Split content into paragraphs
        const paragraphs = pdfContent
          .split(/[.!?]\s+/)
          .map(p => p.trim())
          .filter(p => p.length > 0);

        // Create search patterns
        const patterns = createSearchPatterns(userQuery);
        
        // Search for relevant paragraphs with scoring
        const scoredParagraphs = paragraphs.map(paragraph => ({
          text: paragraph,
          score: scoreParagraph(paragraph, patterns, userQuery)
        }));

        // Sort by relevance score and take top results
        const relevantParagraphs = scoredParagraphs
          .filter(p => p.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 15)  // Take top 15 most relevant paragraphs
          .map(p => p.text);

        relevantInfo = relevantParagraphs.join('\n\n');
        
        // Add structured course information for relevant categories
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

        // If still no results, try lenient search
        if (!relevantInfo) {
          const queryWords = userQuery.toLowerCase().split(/\s+/);
          const lenientResults = paragraphs.filter(p => {
            const paragraphWords = p.toLowerCase().split(/\s+/);
            return queryWords.some(word => 
              word.length > 3 && paragraphWords.some(pWord => pWord.includes(word))
            );
          }).slice(0, 8);  // Take top 8 results from lenient search

          relevantInfo = lenientResults.length > 0 
            ? lenientResults.join('\n\n')
            : "I couldn't find any specific information about that in the course catalog.";
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
        model: 'anthropic/claude-3-opus:20240229',
        messages: messages,
        max_tokens: 4000
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
    if (!process.env.REACT_APP_OPENROUTER_API_KEY) {
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
          'Authorization': `Bearer ${process.env.REACT_APP_OPENROUTER_API_KEY}`,
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
    
    const results = await searchVectorDB(query, 5);
    res.json({ results });
  } catch (error) {
    console.error('Error searching vector database:', error);
    res.status(500).json({ error: 'Failed to search vector database' });
  }
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
  res.json({ 
    status: 'ok',
    version: packageJson.version,
    hasPdfContent: !!pdfContent,
    hasVectorSearch: vectorSearchAvailable,
    vectorCount: inMemoryVectors.length,
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
  res.json({
    pdfContentAvailable: !!pdfContent,
    pdfContentLength: pdfContent ? pdfContent.length : 0,
    vectorSearchAvailable: vectorSearchAvailable,
    vectorCount: inMemoryVectors.length,
    vectorSample: inMemoryVectors.length > 0 ? [
      {
        id: inMemoryVectors[0].id,
        text: inMemoryVectors[0].text,
        embeddingLength: inMemoryVectors[0].embedding ? inMemoryVectors[0].embedding.length : 0
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

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'build', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Environment:', {
    nodeEnv: process.env.NODE_ENV,
    port,
    hasApiKey: !!process.env.REACT_APP_OPENROUTER_API_KEY
  });
});
