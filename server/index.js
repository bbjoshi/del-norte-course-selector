const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const port = process.env.PORT || 3002;

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

// Enable CORS for production
app.use(cors({
  origin: [
    'https://del-norte-course-selector.vercel.app',
    'https://del-norte-course-selector.herokuapp.com',
    'https://del-norte-course-selector.onrender.com',
    process.env.NODE_ENV === 'development' && 'http://localhost:3000'
  ].filter(Boolean),
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
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    console.log('PDF fetched successfully');
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
      throw new Error('OpenRouter API key not configured');
    }

    if (!pdfContent) {
      return res.status(404).json({ error: 'Course catalog not loaded' });
    }

    const userQuery = req.body.messages[0].content;
    
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

    let relevantInfo = relevantParagraphs.join('\n\n');
    
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

    // If no results, try lenient search
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

    // Prepare the prompt for Claude
    const prompt = `
      You are a helpful course selection assistant for Del Norte High School. 
      Use the following information from the course catalog to answer the question.
      Focus on providing specific, actionable advice based on the available courses
      and their prerequisites. If creating a multi-year plan, organize it by grade
      level and include both required and recommended courses. For each course,
      mention prerequisites when available.

      Course Catalog Information:
      ${relevantInfo}
      
      Question: ${userQuery}
      
      Please provide a clear, well-structured answer based on the course catalog information.
      If you're not sure about something, say so rather than making assumptions.
      Focus specifically on answering the question asked, and if certain information isn't
      in the provided text, mention that limitation.
    `;

    console.log('Sending request to Claude...');
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-2',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://del-norte-course-selector.vercel.app',
          'X-Title': 'Del Norte Course Selector',
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Received response from Claude');
    res.json(response.data);
  } catch (error) {
    console.error('Error calling Claude API:', error);
    res.status(500).json({ 
      error: 'Failed to get response from Claude',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    hasPdfContent: !!pdfContent,
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
