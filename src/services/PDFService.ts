import axios from 'axios';

declare const pdfjsLib: any;

export class PDFService {
  private static instance: PDFService | null = null;
  private courseData: string | null = null;
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): PDFService {
    if (!PDFService.instance) {
      PDFService.instance = new PDFService();
    }
    return PDFService.instance;
  }

  private async initializePDFJS(): Promise<void> {
    if (this.initialized) return;

    // Load PDF.js script
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    
    await new Promise<void>((resolve, reject) => {
      script.onload = () => {
        // Set worker source
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        this.initialized = true;
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  public async loadPDF(url: string): Promise<string> {
    if (this.courseData) {
      return this.courseData;
    }

    try {
      console.log('Initializing PDF.js...');
      await this.initializePDFJS();
      
      console.log('Fetching PDF from server...');
      // Use our proxy server to fetch the PDF with a timeout
      const response = await axios.get('/api/pdf', {
        responseType: 'arraybuffer',
        timeout: 30000 // 30 second timeout
      });
      
      // Verify we have valid data
      if (!response.data || response.data.byteLength === 0) {
        throw new Error('Received empty PDF data from server');
      }
      
      console.log(`PDF data received, size: ${response.data.byteLength} bytes`);
      const data = new Uint8Array(response.data);
      
      // Load the PDF document
      console.log('Loading PDF document with PDF.js...');
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      console.log(`PDF loaded successfully with ${pdf.numPages} pages`);
      
      let fullText = '';
      
      // Extract text from each page
      for (let i = 1; i <= pdf.numPages; i++) {
        console.log(`Processing page ${i} of ${pdf.numPages}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: { str: string }) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }

      console.log(`Text extraction complete, total length: ${fullText.length} characters`);
      
      // Store the extracted text on the server
      console.log('Storing extracted text on server...');
      await axios.post('/api/pdf/content', {
        content: fullText
      });
      console.log('Text stored successfully on server');

      this.courseData = fullText;
      return fullText;
    } catch (error: any) {
      // More detailed error logging
      console.error('Error loading PDF:', error);
      
      // Log specific error details based on error type
      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.error('Server responded with error status:', error.response.status);
          console.error('Error response data:', error.response.data);
        } else if (error.request) {
          console.error('No response received from server');
        } else {
          console.error('Error setting up request:', error.message);
        }
      }
      
      // Provide more specific error message if possible
      const errorMessage = axios.isAxiosError(error) && error.response?.status === 502
        ? 'Server error (502 Bad Gateway). The server might be overloaded or temporarily down.'
        : 'Failed to load course catalog PDF';
      
      throw new Error(errorMessage);
    }
  }

  public async searchCourses(query: string): Promise<string> {
    try {
      // Enhance query for better course planning results
      let enhancedQuery = query;
      
      // If query is about a 4-year plan or pathway for a specific field
      if (query.toLowerCase().includes('plan') || 
          query.toLowerCase().includes('pathway') || 
          query.toLowerCase().includes('major') ||
          query.toLowerCase().includes('career')) {
        
        // Add relevant keywords to improve search results
        const fieldMatches = query.match(/for\s+(\w+\s+\w+|\w+)/i);
        const field = fieldMatches ? fieldMatches[1].toLowerCase() : '';
        
        if (field) {
          // Add field-specific keywords
          if (field.includes('engineer') || field === 'engineering') {
            enhancedQuery += ' mathematics physics calculus engineering technology design';
          } else if (field.includes('computer') || field.includes('software') || field.includes('programming')) {
            enhancedQuery += ' computer science programming technology AP';
          } else if (field.includes('medic') || field.includes('doctor') || field.includes('health')) {
            enhancedQuery += ' biology chemistry anatomy physiology health science';
          } else if (field.includes('business') || field.includes('finance') || field.includes('economics')) {
            enhancedQuery += ' economics business finance mathematics statistics';
          }
        }
        
        // Always add general planning keywords
        enhancedQuery += ' prerequisite requirements recommended pathway grade level';
      }
      
      const response = await axios.get('/api/pdf/search', {
        params: { query: enhancedQuery }
      });
      
      if (response.data.results.length === 0) {
        return "I couldn't find any specific information about that in the course catalog. Could you try rephrasing your question?";
      }

      return response.data.results.join('\n\n');
    } catch (error) {
      console.error('Error searching courses:', error);
      throw new Error('Failed to search course catalog');
    }
  }

  public clearCache(): void {
    this.courseData = null;
  }
}

export default PDFService.getInstance();
