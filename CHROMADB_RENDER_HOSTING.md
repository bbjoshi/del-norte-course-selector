# Hosting ChromaDB-based Solution on Render.com

This guide explains how to deploy the Del Norte Course Selector application with ChromaDB to Render.com for production use.

## Overview

Since Render.com doesn't offer Docker services directly, we'll use alternative approaches for deploying ChromaDB:

**Option 1: Use a Web Service with a Custom Dockerfile**
- Deploy ChromaDB as a web service using a custom Dockerfile
- Deploy the Node.js application as a separate web service

**Option 2: Use an External ChromaDB Service**
- Use a third-party hosted ChromaDB service or self-host on another platform
- Deploy only the Node.js application on Render.com

This guide will focus on Option 1, which keeps everything on Render.com.

## Prerequisites

- A Render.com account
- Your application code in a GitHub repository
- VoyageAI API key for embeddings
- OpenRouter API key for chat functionality

## Step 1: Create a ChromaDB Repository with Dockerfile

1. Create a new repository for ChromaDB deployment
2. Add a `Dockerfile` with the following content:

```dockerfile
FROM chromadb/chroma:latest

# Expose the port
EXPOSE 8000

# Set the entry point
ENTRYPOINT ["uvicorn", "chromadb.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

3. Add a `render.yaml` file with the following content:

```yaml
services:
  - type: web
    name: chromadb-service
    env: docker
    plan: standard
    dockerfilePath: ./Dockerfile
    disk:
      name: chroma-data
      mountPath: /chroma/chroma
      sizeGB: 1
    envVars:
      - key: ALLOW_RESET
        value: "true"
    healthCheckPath: /api/v1/heartbeat
```

## Step 2: Deploy ChromaDB to Render.com

1. Push your ChromaDB repository to GitHub
2. Log in to your Render.com dashboard
3. Click on "New" and select "Blueprint"
4. Connect your ChromaDB GitHub repository
5. Render will detect the `render.yaml` file and configure the service
6. Click "Apply" to create the ChromaDB service
7. Wait for the service to deploy and note the URL (e.g., `https://chromadb-service.onrender.com`)

## Step 3: Set Up the Web Service for Del Norte Course Selector

1. In your Render.com dashboard, click on "New" and select "Web Service"
2. Connect your Del Norte Course Selector GitHub repository
3. Configure the service:
   - **Name**: `del-norte-course-selector`
   - **Region**: Same as your ChromaDB service
   - **Branch**: `chroma-integration` (or your production branch)
   - **Root Directory**: Leave empty if your app is at the root
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node server/index.js`
   - **Instance Type**: Start with "Starter" ($7/month) and scale as needed
   - **Health Check Path**: `/health`

4. Add the following environment variables:
   ```
   NODE_ENV=production
   PORT=3000
   CHROMADB_URL=https://chromadb-service.onrender.com
   VOYAGE_API_KEY=your_voyage_api_key
   OPENROUTER_API_KEY=your_openrouter_api_key
   PDF_URL=https://4.files.edl.io/f7e7/02/04/25/231513-8c9f8c2e-257a-49e3-8c4c-ef249811b38e.pdf
   ```

   Replace `your_voyage_api_key` and `your_openrouter_api_key` with your actual API keys, and update the ChromaDB URL to match your deployed ChromaDB service.

5. Click "Create Web Service"

## Step 4: Alternative Option - Using External ChromaDB Service

If you prefer not to host ChromaDB on Render.com, you can:

1. Host ChromaDB on another platform like:
   - AWS using ECS or EC2
   - Google Cloud Run
   - DigitalOcean with Docker
   - Self-hosted server

2. Update the `CHROMADB_URL` environment variable in your Render.com web service to point to your external ChromaDB instance

This approach may offer more flexibility and potentially better performance, but requires managing multiple platforms.

## Step 5: Verify Your Application Code is Production-Ready

The VectorSearchService.js file already includes robust error handling and connection retries for ChromaDB:

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

This code ensures that your application will:
1. Try to connect to ChromaDB multiple times
2. Fall back to in-memory storage if ChromaDB is unavailable
3. Log detailed information about connection attempts

## Step 6: Initial Data Loading

After deployment, you'll need to load your course catalog data into ChromaDB:

1. Wait for both services to be fully deployed
2. Access your application's PDF processing endpoint:
   ```
   curl -X GET https://del-norte-course-selector.onrender.com/api/pdf
   ```

3. Monitor the logs to ensure the PDF is processed and vectors are added to ChromaDB

## Step 7: Monitoring and Scaling

### Monitoring

1. Set up Render.com alerts for both services
2. Use the `/health` endpoint to monitor application status
3. Set up logging to track API usage and performance

### Scaling

As your application grows, you may need to scale:

1. **ChromaDB Web Service**:
   - Upgrade to a larger instance type
   - Increase disk size
   - Consider sharding for very large datasets

2. **Application Web Service**:
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
   - Use Render.com's "Suspend" feature for non-production environments
   - Consider using a cron job to wake up the service only when needed

## Backup Strategy

The project already includes backup and restore scripts in the `scripts/` directory:

1. **backup-chromadb.js**: Exports ChromaDB data to JSON
2. **restore-chromadb.js**: Imports data from JSON back to ChromaDB

To set up regular backups:

1. Create a new Cron Job in Render.com
2. Configure it to run the backup script daily
3. Store backups in a secure location (e.g., AWS S3)

Example cron job command:
```
node scripts/backup-chromadb.js && aws s3 cp backups/* s3://your-bucket/chromadb-backups/
```

## Security Considerations

1. **API Keys**:
   - Store API keys as environment variables
   - Rotate keys regularly
   - Use Render.com's environment variable encryption

2. **Network Security**:
   - Consider setting up a Render.com private network if available
   - Implement proper authentication for your API endpoints

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

By following this guide, you can successfully deploy a ChromaDB-based solution on Render.com for production use, even without a dedicated Docker service option. The setup provides a scalable, reliable, and cost-effective way to leverage vector search capabilities in your application.

Remember to monitor your resources, implement proper error handling, and regularly back up your data to ensure a robust production deployment.
