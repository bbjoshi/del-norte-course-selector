import axios from 'axios';
import { PDFService } from './PDFService';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class ChatService {
  private static instance: ChatService | null = null;
  private readonly pdfService: PDFService;
  private conversationHistory: ChatMessage[] = [];
  private readonly MAX_HISTORY_LENGTH = 20; // Maximum number of messages to keep in history
  private readonly SUMMARIZATION_THRESHOLD = 15; // Threshold to trigger summarization
  private summarizationInProgress = false;

  private constructor() {
    this.pdfService = PDFService.getInstance();
  }

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  public async processQuery(query: string): Promise<string> {
    try {
      // First try vector search
      let relevantInfo = '';
      
      try {
        // Use vector search API
        const vectorResponse = await axios.get('/api/vector-search', {
          params: { query }
        });
        
        if (vectorResponse.data.results && vectorResponse.data.results.length > 0) {
          console.log('Using vector search results');
          relevantInfo = vectorResponse.data.results.join('\n\n');
        }
      } catch (vectorError) {
        console.warn('Vector search failed, falling back to traditional search:', vectorError);
      }
      
      // If vector search didn't return results, fall back to traditional search
      if (!relevantInfo) {
        console.log('Falling back to traditional search');
        relevantInfo = await this.pdfService.searchCourses(query);
      }

      // Add the new user message to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: query
      });
      
      // Check if we need to summarize the conversation
      await this.manageConversationHistory();

      // Call Claude API through our proxy server with the full conversation history
      const response = await axios.post(
        '/api/chat',
        {
          model: 'anthropic/claude-3-opus:20240229',
          messages: this.conversationHistory,
          relevantInfo: relevantInfo // Pass the relevant info separately
        }
      );

      const assistantResponse = response.data.choices[0].message.content;
      
      // Add the assistant's response to conversation history
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantResponse
      });
      
      // Check again after adding assistant response
      await this.manageConversationHistory();

      return assistantResponse;
    } catch (error) {
      console.error('Error processing query:', error);
      throw new Error('Failed to process your question. Please try again.');
    }
  }

  /**
   * Manages conversation history length using sliding window and summarization
   */
  private async manageConversationHistory(): Promise<void> {
    // If summarization is already in progress, use sliding window approach
    if (this.summarizationInProgress || this.conversationHistory.length <= this.SUMMARIZATION_THRESHOLD) {
      if (this.conversationHistory.length > this.MAX_HISTORY_LENGTH) {
        // Keep the first message (often contains important context)
        const firstMessages = this.conversationHistory.slice(0, 2);
        // Keep the most recent messages
        const recentMessages = this.conversationHistory.slice(-(this.MAX_HISTORY_LENGTH - 2));
        // Combine them to form the new history
        this.conversationHistory = [...firstMessages, ...recentMessages];
      }
      return;
    }

    // If conversation exceeds threshold but not yet at max, try to summarize
    if (this.conversationHistory.length >= this.SUMMARIZATION_THRESHOLD && 
        this.conversationHistory.length <= this.MAX_HISTORY_LENGTH) {
      try {
        this.summarizationInProgress = true;
        
        // Select messages to summarize (exclude first 2 and last 5 messages)
        const messagesToSummarize = this.conversationHistory.slice(2, -5);
        
        if (messagesToSummarize.length >= 4) { // Only summarize if we have enough messages
          const summary = await this.summarizeMessages(messagesToSummarize);
          
          // Replace the summarized messages with the summary
          const firstMessages = this.conversationHistory.slice(0, 2);
          const lastMessages = this.conversationHistory.slice(-5);
          
          // Create a system message with the summary
          const summaryMessage: ChatMessage = {
            role: 'system',
            content: `Previous conversation summary: ${summary}`
          };
          
          // Update conversation history
          this.conversationHistory = [...firstMessages, summaryMessage, ...lastMessages];
          console.log('Conversation history summarized');
        }
      } catch (error) {
        console.error('Error summarizing messages:', error);
        // Fall back to sliding window if summarization fails
        if (this.conversationHistory.length > this.MAX_HISTORY_LENGTH) {
          const firstMessages = this.conversationHistory.slice(0, 2);
          const recentMessages = this.conversationHistory.slice(-(this.MAX_HISTORY_LENGTH - 2));
          this.conversationHistory = [...firstMessages, ...recentMessages];
        }
      } finally {
        this.summarizationInProgress = false;
      }
    }
  }

  /**
   * Summarizes a set of messages using the Claude API
   */
  private async summarizeMessages(messages: ChatMessage[]): Promise<string> {
    try {
      // Format messages for summarization
      const formattedMessages = messages.map(msg => 
        `${msg.role.toUpperCase()}: ${msg.content}`
      ).join('\n\n');
      
      // Create a summarization prompt
      const summarizationPrompt = `
        Please summarize the following conversation exchange concisely, capturing the key points, 
        questions asked, and information provided. Focus on course-related information and recommendations.
        
        CONVERSATION TO SUMMARIZE:
        ${formattedMessages}
        
        SUMMARY:
      `;
      
      // Call the API to summarize
      const response = await axios.post(
        '/api/summarize',
        {
          messages: [
            {
              role: 'user',
              content: summarizationPrompt
            }
          ]
        }
      );
      
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Error summarizing messages:', error);
      throw error;
    }
  }
}

export default ChatService.getInstance();
