# Free Hosting Guide

This guide outlines how to host the Del Norte Course Selector using free-tier services.

## Free Hosting Options

### Frontend Hosting
**Vercel (Recommended)**
- Free tier includes:
  - Unlimited static sites
  - Serverless functions
  - Automatic HTTPS
  - Global CDN
  - Continuous deployment
  - Analytics

**Alternative: Netlify**
- Free tier includes:
  - Unlimited static sites
  - Form handling
  - Identity service (auth)
  - Functions
  - HTTPS

### Backend Hosting
**Railway.app**
- Free tier includes:
  - 500 hours/month
  - 512MB RAM
  - Shared CPU
  - 1GB disk

**Alternative: Render**
- Free tier includes:
  - Static site hosting
  - Web services
  - Automatic HTTPS
  - Global CDN
  - DDoS protection

### Database
**MongoDB Atlas**
- Free tier (M0) includes:
  - 512MB storage
  - Shared RAM
  - Basic monitoring
  - Automatic backups

### Authentication
**Firebase**
- Free tier (Spark) includes:
  - 50K monthly active users
  - 10K authentication calls/month
  - Multiple auth providers
  - Email verification

### API Services
**OpenRouter**
- Free credits for testing
- Pay-as-you-go after credits
- Can implement rate limiting to control costs

## Setup Instructions

### 1. Frontend Deployment (Vercel)
1. Push code to GitHub
2. Connect to Vercel
3. Configure build settings:
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "package.json",
         "use": "@vercel/static-build"
       }
     ]
   }
   ```

### 2. Backend Deployment (Railway)
1. Create Railway account
2. Connect GitHub repository
3. Set environment variables:
   ```
   NODE_ENV=production
   PORT=3002
   ```
4. Configure start command:
   ```
   node server/index.js
   ```

### 3. Database Setup (MongoDB Atlas)
1. Create free cluster
2. Configure network access
3. Create database user
4. Get connection string
5. Add to environment variables:
   ```
   MONGODB_URI=your_connection_string
   ```

### 4. Firebase Setup
1. Create Firebase project
2. Enable Authentication
3. Add configuration to .env:
   ```
   REACT_APP_FIREBASE_API_KEY=your_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_domain
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   ```

## Cost Control Strategies

### 1. OpenRouter API
- Implement caching for common queries
- Store responses in MongoDB
- Rate limit per user
- Example caching implementation:
  ```javascript
  // In server/index.js
  const cache = new Map();
  const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  app.post('/api/chat', async (req, res) => {
    const cacheKey = req.body.messages[0].content;
    
    if (cache.has(cacheKey)) {
      const { response, timestamp } = cache.get(cacheKey);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return res.json(response);
      }
    }
    
    // Proceed with API call if not in cache
    // Store response in cache
  });
  ```

### 2. Database Optimization
- Implement document expiration
- Index frequently queried fields
- Limit stored data size
- Example MongoDB indexes:
  ```javascript
  db.queries.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 86400 });
  db.queries.createIndex({ "content": "text" });
  ```

### 3. Backend Resources
- Implement serverless functions where possible
- Use edge caching
- Optimize response sizes
- Example edge caching:
  ```javascript
  app.get('/api/pdf/content', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    // Serve content
  });
  ```

## Scaling Considerations

### When to Upgrade
Monitor these metrics:
1. Database storage (upgrade at 80% of 512MB)
2. Monthly active users (upgrade at 40K users)
3. API costs (implement premium features)

### Free Tier Limits
- MongoDB: 512MB storage
- Vercel: 100GB bandwidth/month
- Railway: 500 hours/month
- Firebase: 50K monthly active users

## Monitoring & Logs

### Free Monitoring Tools
1. **MongoDB Atlas Monitoring**
   - Basic metrics
   - Slow query analysis
   - Connection monitoring

2. **Vercel Analytics**
   - Performance monitoring
   - User analytics
   - Error tracking

3. **Firebase Analytics**
   - User behavior
   - Authentication stats
   - Crash reporting

### Logging Strategy
```javascript
// Simple logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Error logging
app.use((error, req, res, next) => {
  console.error(`${new Date().toISOString()} - Error:`, error);
  res.status(500).json({ error: 'Internal server error' });
});
```

## Backup Strategy

### Database Backups
- Use MongoDB Atlas automated backups
- Export data periodically:
  ```bash
  mongodump --uri="your_connection_string" --out=backup
  ```

### Code Backups
- Use GitHub for version control
- Enable GitHub Actions for automated tasks
- Example backup workflow:
  ```yaml
  name: Backup
  on:
    schedule:
      - cron: '0 0 * * 0'
  jobs:
    backup:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v2
        - name: Create backup
          run: |
            npm run backup
  ```

## Security Measures

### Free Security Tools
1. **Cloudflare Free Plan**
   - DDoS protection
   - SSL/TLS
   - Basic firewall

2. **GitHub Security Features**
   - Dependabot alerts
   - Code scanning
   - Secret scanning

3. **Firebase Security Rules**
   ```javascript
   {
     "rules": {
       ".read": "auth != null",
       ".write": "auth != null"
     }
   }
   ```

## Development Workflow

### Local Development
```bash
# Start development server
npm run dev

# Start backend
node server/index.js

# Run tests
npm test
```

### Deployment
```bash
# Deploy frontend
git push vercel main

# Deploy backend
git push railway main
```

## Maintenance Tasks

### Weekly Tasks
1. Review logs for errors
2. Check resource usage
3. Update dependencies
4. Backup database

### Monthly Tasks
1. Security audit
2. Performance review
3. Clean up unused data
4. Update documentation

## Future Considerations

### When to Move to Paid Services
1. Database storage exceeds 400MB
2. Monthly active users exceed 40K
3. API costs become significant
4. Need for advanced monitoring

### Cost-Effective Upgrades
1. Selective service upgrades
2. Implement caching first
3. Optimize before scaling
4. Use serverless where possible
