import axios from 'axios';
import { PDFService } from './PDFService';

export class ChatService {
  private static instance: ChatService | null = null;
  private readonly pdfService: PDFService;

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
      // First, search the course catalog
      const relevantInfo = await this.pdfService.searchCourses(query);

      // Prepare the prompt for Claude
      const prompt = `
        You are a helpful course selection assistant for Del Norte High School. 
        Use the following information from the course catalog to answer the question:
        
        ${relevantInfo}
        
        Question: ${query}
        
        Please provide a clear and concise answer based on the course catalog information.
        If you're not sure about something, say so rather than making assumptions.
      `;

      // Call Claude API through our proxy server
      const response = await axios.post(
        'http://localhost:3002/api/chat',
        {
          model: 'anthropic/claude-2',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Error processing query:', error);
      throw new Error('Failed to process your question. Please try again.');
    }
  }
}

export default ChatService.getInstance();
