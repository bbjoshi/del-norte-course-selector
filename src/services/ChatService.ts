 import axios from 'axios';
import { PDFService } from './PDFService';

interface EmbeddingsStatus {
  inProgress: boolean;
  complete: boolean;
  error: string | null;
  progress: number;
  vectorCount: number;
  vectorSearchAvailable: boolean;
}

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
  private transcriptText: string | null = null;
  private transcriptFilename: string | null = null;
  private transcriptAnalysisSummary: string | null = null;

  private constructor() {
    this.pdfService = PDFService.getInstance();
  }

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  /**
   * Set transcript text from an uploaded PDF and run agentic analysis
   */
  public setTranscript(text: string, filename: string): void {
    this.transcriptText = text;
    this.transcriptFilename = filename;
    this.transcriptAnalysisSummary = null; // Will be populated by runAnalysis
  }

  /**
   * Run the agentic analysis pipeline on the uploaded document
   * Returns the analysis result for UI display
   */
  public async runAnalysis(): Promise<any> {
    if (!this.transcriptText || !this.transcriptFilename) {
      throw new Error('No document loaded to analyze');
    }
    try {
      console.log('Running agentic analysis pipeline...');
      const response = await axios.post('/api/document/analyze', {
        text: this.transcriptText,
        filename: this.transcriptFilename,
      });
      if (response.data.success && response.data.analysis?.summary) {
        this.transcriptAnalysisSummary = response.data.analysis.summary;
        console.log(`Agentic analysis complete in ${response.data.analysis.processingTimeMs}ms`);
        return response.data.analysis;
      }
    } catch (err) {
      console.error('Agentic analysis failed, will use raw text as fallback:', err);
    }
    return null;
  }

  /**
   * Clear uploaded transcript
   */
  public clearTranscript(): void {
    this.transcriptText = null;
    this.transcriptFilename = null;
    this.transcriptAnalysisSummary = null;
  }

  /**
   * Check if a transcript is loaded
   */
  public hasTranscript(): boolean {
    return !!this.transcriptText;
  }

  public getTranscriptFilename(): string | null {
    return this.transcriptFilename;
  }

  /**
   * Check the status of embeddings generation
   */
  public async checkEmbeddingsStatus(): Promise<EmbeddingsStatus> {
    try {
      const response = await axios.get('/api/embeddings-status');
      return response.data;
    } catch (error) {
      console.error('Error checking embeddings status:', error);
      // Return a default status if the request fails
      return {
        inProgress: false,
        complete: false,
        error: 'Failed to check embeddings status',
        progress: 0,
        vectorCount: 0,
        vectorSearchAvailable: false
      };
    }
  }

  /**
   * Process a user query and get a response
   */
  public async processQuery(query: string): Promise<string> {
    try {
      // First try vector search
      let relevantInfo = '';
      let vectorSearchAttempted = false;
      
      try {
        // Check embeddings status first
        const embeddingsStatus = await this.checkEmbeddingsStatus();
        
        // If embeddings are still being generated, we can either:
        // 1. Wait for them to complete (if they're close to done)
        // 2. Fall back to traditional search immediately
        if (embeddingsStatus.inProgress) {
          // If progress is over 90%, wait a bit for it to complete
          if (embeddingsStatus.progress > 90) {
            console.log('Embeddings almost complete, waiting briefly...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            
            // Check status again
            const updatedStatus = await this.checkEmbeddingsStatus();
            if (!updatedStatus.inProgress && updatedStatus.vectorSearchAvailable) {
              // Now we can use vector search
              const vectorResponse = await axios.get('/api/vector-search', {
                params: { query }
              });
              
              if (vectorResponse.data.results && vectorResponse.data.results.length > 0) {
                console.log('Using vector search results');
                relevantInfo = vectorResponse.data.results.join('\n\n');
                vectorSearchAttempted = true;
              }
            } else {
              console.log('Embeddings still not ready, falling back to traditional search');
            }
          } else {
            console.log('Embeddings still being generated, falling back to traditional search');
          }
        } else if (!embeddingsStatus.error) {
          // Embeddings are ready, use vector search
          const vectorResponse = await axios.get('/api/vector-search', {
            params: { query }
          });
          
          if (vectorResponse.data.results && vectorResponse.data.results.length > 0) {
            console.log('Using vector search results');
            relevantInfo = vectorResponse.data.results.join('\n\n');
            vectorSearchAttempted = true;
          }
        }
      } catch (vectorError) {
        console.warn('Vector search failed, falling back to traditional search:', vectorError);
        vectorSearchAttempted = true;
      }
      
      // If vector search didn't return results or wasn't attempted, fall back to traditional search
      if (!relevantInfo) {
        if (vectorSearchAttempted) {
          console.log('Falling back to traditional search');
        } else {
          console.log('Using traditional search');
        }
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
      // Prefer structured analysis summary over raw text for better recommendations
      const transcriptData = this.transcriptAnalysisSummary
        ? this.transcriptAnalysisSummary  // Use structured analysis (agentic pipeline output)
        : (this.transcriptText || undefined);  // Fallback to raw text
      
      const response = await axios.post(
        '/api/chat',
        {
          model: 'anthropic/claude-3-opus:20240229',
          messages: this.conversationHistory,
          relevantInfo: relevantInfo, // Pass the relevant info separately
          transcriptText: transcriptData,
          transcriptFilename: this.transcriptFilename || undefined,
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
