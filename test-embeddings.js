const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:3003'; // Adjust if your server runs on a different port

/**
 * Test script to verify vector embeddings generation and usage
 */
async function testEmbeddings() {
  try {
    console.log('Starting embeddings test...');
    
    // Step 1: Check current embeddings status
    console.log('\n1. Checking current embeddings status...');
    const statusResponse = await axios.get(`${API_BASE_URL}/api/embeddings-status`);
    console.log('Current embeddings status:', statusResponse.data);
    
    const vectorSearchAvailable = statusResponse.data.vectorSearchAvailable;
    const vectorCount = statusResponse.data.vectorCount;
    
    // Step 2: If no vectors available, trigger PDF processing
    if (!vectorSearchAvailable || vectorCount === 0) {
      console.log('\n2. No vectors available. Triggering PDF processing...');
      
      // First, check if we have a PDF file
      const pdfPath = path.join(__dirname, 'Del Norte Course Catalog 2025-2026.pdf');
      if (!fs.existsSync(pdfPath)) {
        console.log('PDF file not found. Fetching from server...');
        const pdfResponse = await axios.get(`${API_BASE_URL}/api/pdf`, { responseType: 'arraybuffer' });
        fs.writeFileSync(pdfPath, Buffer.from(pdfResponse.data));
        console.log('PDF file saved locally.');
      }
      
      // Read the PDF file
      const pdfBuffer = fs.readFileSync(pdfPath);
      
      // Extract text from PDF
      console.log('Extracting text from PDF...');
      const pdfData = await pdfParse(pdfBuffer);
      const pdfContent = pdfData.text;
      console.log(`Extracted ${pdfContent.length} characters from PDF`);
      
      // Send the actual PDF content to the server
      console.log('Sending PDF content to server...');
      await axios.post(`${API_BASE_URL}/api/pdf/content`, { content: pdfContent });
      
      // Wait for embeddings to be generated
      console.log('Waiting for embeddings to be generated...');
      let embeddingsReady = false;
      let attempts = 0;
      const maxAttempts = 30; // Increased from 10 to 30 attempts (60 seconds total)
      let lastProgress = 0;
      let stagnantProgressCount = 0;
      
      while (!embeddingsReady && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        try {
          const updatedStatus = await axios.get(`${API_BASE_URL}/api/embeddings-status`);
          const currentProgress = updatedStatus.data.progress;
          console.log('Embeddings generation progress:', currentProgress + '%');
          
          // Check if progress is stagnant
          if (currentProgress === lastProgress) {
            stagnantProgressCount++;
            if (stagnantProgressCount >= 5) {
              console.log('Progress appears to be stagnant. Checking server status...');
              try {
                const healthResponse = await axios.get(`${API_BASE_URL}/health`);
                console.log('Server health status:', healthResponse.data.status);
                console.log('Vector count from health check:', healthResponse.data.vectorCount);
              } catch (healthError) {
                console.error('Error checking server health:', healthError.message);
              }
            }
          } else {
            stagnantProgressCount = 0;
          }
          lastProgress = currentProgress;
          
          if (updatedStatus.data.complete || updatedStatus.data.vectorCount > 0) {
            embeddingsReady = true;
            console.log('Embeddings generation completed!');
            console.log('Vector count:', updatedStatus.data.vectorCount);
          }
          
          // Check for errors even during processing
          if (updatedStatus.data.error) {
            console.error('Embeddings generation error detected:', updatedStatus.data.error);
            // Continue waiting in case the process recovers
          }
        } catch (statusError) {
          console.error('Error checking embeddings status:', statusError.message);
          // Continue waiting in case the server recovers
        }
        
        attempts++;
      }
      
      if (!embeddingsReady) {
        console.log('Embeddings generation timed out or failed after', attempts * 2, 'seconds.');
        console.log('Checking for errors...');
        
        try {
          const finalStatus = await axios.get(`${API_BASE_URL}/api/embeddings-status`);
          if (finalStatus.data.error) {
            console.error('Embeddings generation error:', finalStatus.data.error);
          }
          
          // Get detailed debug information
          const debugResponse = await axios.get(`${API_BASE_URL}/debug/pdf-status`);
          console.log('Final debug information:');
          console.log('- Vector search available:', debugResponse.data.vectorSearchAvailable);
          console.log('- Vector count:', debugResponse.data.vectorCount);
          console.log('- Embeddings generation in progress:', debugResponse.data.embeddingsGenerationInProgress);
          console.log('- Embeddings generation complete:', debugResponse.data.embeddingsGenerationComplete);
          console.log('- Embeddings generation error:', debugResponse.data.embeddingsGenerationError);
        } catch (finalStatusError) {
          console.error('Error getting final status:', finalStatusError.message);
        }
      }
    } else {
      console.log('\n2. Vectors already available. Skipping PDF processing.');
    }
    
    // Step 3: Get detailed debug information
    console.log('\n3. Getting detailed debug information...');
    const debugResponse = await axios.get(`${API_BASE_URL}/debug/pdf-status`);
    console.log('Debug information:');
    console.log('- PDF content available:', debugResponse.data.pdfContentAvailable);
    console.log('- PDF content length:', debugResponse.data.pdfContentLength);
    console.log('- Vector search available:', debugResponse.data.vectorSearchAvailable);
    console.log('- Vector count:', debugResponse.data.vectorCount);
    console.log('- Embeddings generation in progress:', debugResponse.data.embeddingsGenerationInProgress);
    console.log('- Embeddings generation complete:', debugResponse.data.embeddingsGenerationComplete);
    console.log('- Embeddings generation error:', debugResponse.data.embeddingsGenerationError);
    
    if (debugResponse.data.vectorSample && debugResponse.data.vectorSample.length > 0) {
      console.log('- Vector sample ID:', debugResponse.data.vectorSample[0].id);
      console.log('- Vector sample embedding length:', debugResponse.data.vectorSample[0].embeddingLength);
      console.log('- Vector sample text preview:', debugResponse.data.vectorSample[0].text.substring(0, 50) + '...');
    }
    
    // Step 4: Test vector search with multiple queries
    console.log('\n4. Testing vector search with multiple queries...');
    const testQueries = [
      'What math courses are available for 9th grade?',
      'Tell me about AP Chemistry',
      'What are the engineering electives?',
      'What courses fulfill the UC requirements?'
    ];
    
    let vectorSearchSuccessCount = 0;
    
    for (const testQuery of testQueries) {
      console.log(`\nTesting query: "${testQuery}"`);
      
      // First, try vector search
      console.log('Sending query to vector search endpoint...');
      const vectorSearchResponse = await axios.get(`${API_BASE_URL}/api/vector-search`, {
        params: { query: testQuery }
      });
      
      console.log('Vector search results:');
      if (vectorSearchResponse.data.results && vectorSearchResponse.data.results.length > 0) {
        console.log(`Found ${vectorSearchResponse.data.results.length} results from vector search`);
        console.log('First result:', vectorSearchResponse.data.results[0].substring(0, 100) + '...');
        console.log('Vector search is working correctly for this query!');
        vectorSearchSuccessCount++;
      } else if (vectorSearchResponse.data.status === 'processing') {
        console.log('Embeddings generation is still in progress. Progress:', vectorSearchResponse.data.progress + '%');
      } else {
        console.log('No results from vector search for this query. This might indicate a problem.');
        
        // Try traditional search as a fallback
        console.log('Testing traditional search as fallback...');
        const traditionalSearchResponse = await axios.get(`${API_BASE_URL}/api/pdf/search`, {
          params: { query: testQuery }
        });
        
        if (traditionalSearchResponse.data.results && traditionalSearchResponse.data.results.length > 0) {
          console.log(`Found ${traditionalSearchResponse.data.results.length} results from traditional search`);
          console.log('Traditional search is working as a fallback for this query.');
        } else {
          console.log('No results from traditional search either. Check if PDF content is loaded.');
        }
      }
    }
    
    console.log(`\nVector search success rate: ${vectorSearchSuccessCount}/${testQueries.length} queries (${(vectorSearchSuccessCount/testQueries.length*100).toFixed(2)}%)`);
    
    // Step 5: Test the chat endpoint which should use vector search
    console.log('\n5. Testing chat endpoint (which should use vector search internally)...');
    const sampleQuery = "What math courses are available for 9th grade?";
    const chatResponse = await axios.post(`${API_BASE_URL}/api/chat`, {
      messages: [
        { role: 'user', content: sampleQuery }
      ]
    });
    
    if (chatResponse.data.choices && chatResponse.data.choices.length > 0) {
      console.log('Chat response received successfully!');
      console.log('Response preview:', chatResponse.data.choices[0].message.content.substring(0, 150) + '...');
      console.log('The chat endpoint is working, which should be using vector search if available.');
    } else {
      console.log('No response from chat endpoint or unexpected response format.');
      console.log('Response data:', chatResponse.data);
    }
    
    // Final status check
    console.log('\n6. Final embeddings status check:');
    const finalStatus = await axios.get(`${API_BASE_URL}/api/embeddings-status`);
    console.log('Final embeddings status:', finalStatus.data);
    
    if (finalStatus.data.vectorSearchAvailable && finalStatus.data.vectorCount > 0) {
      console.log('\nSUCCESS: Vector embeddings are generated and available for search!');
    } else if (finalStatus.data.error) {
      console.log('\nFAILURE: Error in embeddings generation:', finalStatus.data.error);
    } else if (finalStatus.data.inProgress) {
      console.log('\nIN PROGRESS: Embeddings generation is still ongoing. Progress:', finalStatus.data.progress + '%');
    } else {
      console.log('\nUNKNOWN: Could not determine the status of vector embeddings.');
    }
    
  } catch (error) {
    console.error('Error during embeddings test:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testEmbeddings();
