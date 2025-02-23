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
      await this.initializePDFJS();
      
      // Use our proxy server to fetch the PDF
      const response = await axios.get('http://localhost:3002/api/pdf', {
        responseType: 'arraybuffer'
      });
      const data = new Uint8Array(response.data);
      
      // Load the PDF document
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      
      let fullText = '';
      
      // Extract text from each page
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: { str: string }) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }

      // Store the extracted text on the server
      await axios.post('http://localhost:3002/api/pdf/content', {
        content: fullText
      });

      this.courseData = fullText;
      return fullText;
    } catch (error) {
      console.error('Error loading PDF:', error);
      throw new Error('Failed to load course catalog PDF');
    }
  }

  public async searchCourses(query: string): Promise<string> {
    try {
      const response = await axios.get('http://localhost:3002/api/pdf/search', {
        params: { query }
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
