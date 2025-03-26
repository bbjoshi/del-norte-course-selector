const axios = require('axios');
const PDFService = require('./PDFService');
const VectorSearchService = require('./VectorSearchService');
const SearchService = require('./SearchService');

/**
 * Service for handling chat operations
 */
class ChatService {
  /**
   * Process a chat query
   * @param {Array<{role: string, content: string}>} conversationHistory - Conversation history
   * @param {string} userQuery - User query
   * @returns {Promise<string>} - Assistant response
   */
  async processQuery(conversationHistory, userQuery) {
    try {
      if (!process.env.REACT_APP_OPENROUTER_API_KEY) {
        throw new Error('No API key configured for OpenRouter');
      }

      // Define maximum allowed messages to prevent excessively large requests
      const MAX_ALLOWED_MESSAGES = 20;
      
      // Trim conversation history if it exceeds the maximum length
      let trimmedHistory = [...conversationHistory];
      if (trimmedHistory.length > MAX_ALLOWED_MESSAGES) {
        // Keep the first two messages (often contain important context)
        const firstMessages = trimmedHistory.slice(0, 2);
        // Keep the most recent messages
        const recentMessages = trimmedHistory.slice(-(MAX_ALLOWED_MESSAGES - 2));
        // Combine them to form the new history
        trimmedHistory = [...firstMessages, ...recentMessages];
        console.log(`Trimmed conversation history from ${conversationHistory.length} to ${trimmedHistory.length} messages`);
      }
      
      // Get relevant info for the query
      let relevantInfo = await this.getRelevantInfo(userQuery);
      
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
      const messages = [systemMessage, ...trimmedHistory];

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
      
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling OpenRouter API:', error);
      throw new Error('Failed to get response from OpenRouter: ' + error.message);
    }
  }

  /**
   * Get relevant information for a query
   * @param {string} query - User query
   * @returns {Promise<string>} - Relevant information
   */
  async getRelevantInfo(query) {
    try {
      // First try vector search
      const vectorResults = await VectorSearchService.search(query, 5);
      console.log(`Found ${vectorResults.length} results from vector search`);
      
      // Combine vector search results
      let relevantInfo = vectorResults.join('\n\n');
      
      // If vector search didn't return results, fall back to traditional search
      if (!relevantInfo) {
        console.log('Falling back to traditional search...');
        
        const pdfContent = PDFService.getPDFContent();
        if (pdfContent) {
          const relevantParagraphs = SearchService.search(pdfContent, query);
          relevantInfo = relevantParagraphs.join('\n\n');
          
          // Add structured course information for relevant categories
          if (query.toLowerCase().includes('plan') || query.toLowerCase().includes('pathway')) {
            const courseStructure = PDFService.getCourseStructure();
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
        }
      }
      
      return relevantInfo || "I couldn't find any specific information about that in the course catalog.";
    } catch (error) {
      console.error('Error getting relevant info:', error);
      return "I couldn't find any specific information about that in the course catalog.";
    }
  }

  /**
   * Summarize conversation
   * @param {Array<{role: string, content: string}>} messages - Messages to summarize
   * @returns {Promise<string>} - Conversation summary
   */
  async summarizeConversation(messages) {
    try {
      if (!process.env.REACT_APP_OPENROUTER_API_KEY) {
        throw new Error('No API key configured for OpenRouter');
      }

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
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Error summarizing conversation:', error);
      throw new Error('Failed to summarize conversation: ' + error.message);
    }
  }
}

// Export as singleton
module.exports = new ChatService();
