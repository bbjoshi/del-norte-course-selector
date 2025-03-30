# Hosting ChromaDB-based Solution on Render.com

This guide explains how to deploy the Del Norte Course Selector application with ChromaDB to Render.com for production use.

## Overview

The deployment consists of two main components:
1. **Web Service**: The Node.js application (Del Norte Course Selector)
2. **Docker Service**: ChromaDB running in a Docker container

## Prerequisites

- A Render.com account
- Your application code in a GitHub repository
- VoyageAI API key for embeddings
- OpenRouter API key for chat functionality

## Step 1: Set Up ChromaDB as a Docker Service

1. Log in to your Render.com dashboard
2. Click on "New" and select "Docker Service"
3. Connect your GitHub repository or use the following settings for a public image:
   - **Name**: `chromadb`
   - **Image**: `chromadb/chroma:latest`
   - **Region**: Choose the region closest to your users
   - **Instance Type**: Start with "Starter" ($7/month) and scale as needed
   - **Disk**: Add at least 1GB persistent disk for ChromaDB data storage
   - **Environment Variables**: None required for basic setup
   - **Port**: `8000`

4. Under "Advanced" settings, add a persistent volume:
   - **Mount Path**: `/chroma/chroma`
   - **Volume Size**: 1GB (increase as needed)

5. Click "Create Docker Service"

## Step 2: Set Up the Web Service

1. In your Render.com dashboard, click on "New" and select "Web Service"
2. Connect your GitHub repository
3. Configure the service:
   - **Name**: `del-norte-course-selector`
   - **Region**: Same as your ChromaDB service
   - **Branch**: `main` (or your production branch)
   - **Root Directory**: Leave empty if your app is at the root
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node server/index.js`
   - **Instance Type**: Start with "Starter" ($7/month) and scale as needed

4. Add the following environment variables:
   ```
   NODE_ENV=production
   PORT=3000
   CHROMADB_URL=https://chromadb.onrender.com
   VOYAGE_API_KEY=your_voyage_api_key
   OPENROUTER_API_KEY=your_openrouter_api_key
   PDF_URL=https://4.files.edl.io/f7e7/02/04/25/231513-8c9f8c2e-257a-49e3-8c4c-ef249811b38e.pdf
   ```

   Replace `your_voyage_api_key` and `your_openrouter_api_key` with your actual API keys.

5. Click "Create Web Service"

## Step 3: Configure Internal Network Access

To allow your web service to communicate with ChromaDB securely:

1. Go to your Render.com dashboard
2. Navigate to "Network" and create a new private network
3. Add both your web service and ChromaDB service to this network
4. Update the `CHROMADB_URL` environment variable in your web service to use the internal network URL:
   ```
   CHROMADB_URL=http://chromadb:8000
   ```

## Step 4: Update Your Application Code

Ensure your application code is ready for production:

1. Make sure error handling is robust
2. Implement connection retries for ChromaDB
3. Add proper logging

Here's an example of improved ChromaDB initialization with retries:

```javascript
async initializeChromaDB() {
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 5000; // 5 seconds
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Initializing ChromaDB (attempt ${attempt}/${MAX_RETRIES})...`);
      
      // Create ChromaDB client
      this.client = new ChromaClient({
        path: process.env.CHROMADB_URL || 'http://localhost:8000'
      });
      
      // Check if ChromaDB is available
      await this.client.heartbeat();
      console.log('ChromaDB is available');
      
      // Get or create collection
      const collections = await this.client.listCollections();
      if (collections.some(c => c.name === this.collectionName)) {
        console.log(`Collection ${this.collectionName} already exists`);
        this.collection = await this.client.getCollection({
          name: this.collectionName
        });
        
        // Get count of vectors in collection
        const count = await this.collection.count();
        this.vectorCount = count;
        console.log(`Collection has ${count} vectors`);
      } else {
        console.log(`Creating new collection: ${this.collectionName}`);
        this.collection = await this.client.createCollection({
          name: this.collectionName,
          metadata: { description: 'Del Norte High School Course Catalog' }
        });
      }
      
      this.vectorSearchAvailable = true;
      console.log('ChromaDB initialized successfully');
      return;
    } catch (error) {
      console.error(`Failed to initialize ChromaDB (attempt ${attempt}/${MAX_RETRIES}):`, error);
      
      if (attempt === MAX_RETRIES) {
        console.error('All ChromaDB initialization attempts failed, falling back to in-memory store');
        this.vectorSearchAvailable = false;
        this.inMemoryVectors = [];
        this.vocabulary = new Set();
        return;
      }
      
      // Wait before retrying
      console.log(`Retrying in ${RETRY_DELAY/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
}
```

## Step 5: Initial Data Loading

After deployment, you'll need to load your course catalog data into ChromaDB:

1. Access your application
2. Trigger the PDF processing endpoint:
   ```
   curl -o course_catalog.pdf https://your-app.onrender.com/api/pdf
   ```

3. Monitor the logs to ensure the PDF is processed and vectors are added to ChromaDB

## Step 6: Monitoring and Scaling

### Monitoring

1. Set up Render.com alerts for both services
2. Monitor disk usage for ChromaDB
3. Set up logging to track API usage and performance

### Scaling

As your application grows, you may need to scale:

1. **ChromaDB Service**:
   - Upgrade to a larger instance type
   - Increase disk size
   - Consider sharding for very large datasets

2. **Web Service**:
   - Upgrade to a larger instance type
   - Enable auto-scaling if needed

## Cost Optimization

To optimize costs while using ChromaDB on Render.com:

1. **Caching**:
   - Implement caching for common queries
   - Cache embeddings to reduce API calls to VoyageAI

2. **Batch Processing**:
   - Process PDF content in batches
   - Generate embeddings in batches

3. **Scheduled Scaling**:
   - Scale down during low-traffic periods
   - Scale up during high-traffic periods

## Backup Strategy

To ensure data durability:

1. **Regular Backups**:
   - Set up a scheduled job to export ChromaDB data
   - Store backups in a secure location (e.g., AWS S3)

2. **Backup Script**:
   Create a script to export ChromaDB data:

   ```javascript
   const { ChromaClient } = require('chromadb');
   const fs = require('fs');
   
   async function backupChromaDB() {
     const client = new ChromaClient({
       path: process.env.CHROMADB_URL
     });
     
     const collections = await client.listCollections();
     
     for (const collectionInfo of collections) {
       const collection = await client.getCollection({
         name: collectionInfo.name
       });
       
       const data = await collection.get();
       
       fs.writeFileSync(
         `backup_${collectionInfo.name}_${new Date().toISOString()}.json`,
         JSON.stringify(data, null, 2)
       );
       
       console.log(`Backed up collection: ${collectionInfo.name}`);
     }
   }
   
   backupChromaDB().catch(console.error);
   ```

## Security Considerations

1. **API Keys**:
   - Store API keys as environment variables
   - Rotate keys regularly

2. **Network Security**:
   - Use Render.com's private networking
   - Restrict access to ChromaDB service

3. **Data Protection**:
   - Implement rate limiting
   - Add authentication if needed

## Troubleshooting

### Common Issues

1. **ChromaDB Connection Failures**:
   - Check network connectivity
   - Verify environment variables
   - Check ChromaDB service logs

2. **Vector Search Not Working**:
   - Verify vectors are being added to ChromaDB
   - Check embedding generation
   - Verify query format

3. **Performance Issues**:
   - Monitor resource usage
   - Optimize query patterns
   - Consider scaling up resources

## Conclusion

By following this guide, you can successfully deploy a ChromaDB-based solution on Render.com for production use. The setup provides a scalable, reliable, and cost-effective way to leverage vector search capabilities in your application.

Remember to monitor your resources, implement proper error handling, and regularly back up your data to ensure a robust production deployment.
