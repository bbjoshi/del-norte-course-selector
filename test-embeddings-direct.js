const VectorSearchService = require('./server/services/VectorSearchService');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function testEmbeddingsGeneration() {
  try {
    console.log('Testing embeddings generation directly...');
    console.log('OpenRouter API Key available:', !!process.env.REACT_APP_OPENROUTER_API_KEY);
    
    const testInput = ['This is a test input for embeddings generation'];
    console.log('Generating embeddings for:', testInput);
    
    const embeddings = await VectorSearchService.generateEmbeddings(testInput);
    
    if (embeddings && embeddings.length > 0) {
      console.log('Successfully generated embeddings!');
      console.log('Number of embeddings:', embeddings.length);
      console.log('Embedding length:', embeddings[0].length);
      console.log('First 5 values of the embedding:', embeddings[0].slice(0, 5));
      return true;
    } else {
      console.log('Failed to generate embeddings.');
      return false;
    }
  } catch (error) {
    console.error('Error testing embeddings generation:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

// Run the test
testEmbeddingsGeneration()
  .then(success => {
    console.log('Test completed with result:', success ? 'SUCCESS' : 'FAILURE');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
