# Del Norte Course Selector

An intelligent course selection assistant for Del Norte High School students. The application helps students explore courses, understand prerequisites, and create academic plans tailored to their interests and career goals.

## Vector Search Enhancement

This application now supports ChromaDB for enhanced vector search capabilities. ChromaDB provides:

- Persistent storage of embeddings
- Better search performance
- Higher quality search results
- Scalability for larger datasets

To set up ChromaDB, run the provided setup script:

```bash
./setup-chromadb.sh
```

Or follow the manual setup instructions in [CHROMADB_SETUP.md](CHROMADB_SETUP.md).

## Features

- Interactive chat interface powered by Claude AI
- Intelligent search through course catalog content
- Course categorization and relationship mapping
- Multi-year academic planning assistance
- Prerequisite tracking and recommendations
- Firebase authentication for user management

## Tech Stack

- Frontend: React with TypeScript, Material-UI
- Backend: Node.js, Express
- AI: Claude via OpenRouter API
- Authentication: Firebase
- Database: Firebase Realtime Database
- PDF Processing: PDF.js
- Vector Search: ChromaDB (optional)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# OpenRouter API
REACT_APP_OPENROUTER_API_KEY=your_api_key

# Optional PDF URL (defaults to Del Norte catalog if not provided)
PDF_URL=your_pdf_url

# ChromaDB URL (optional, for vector search enhancement)
CHROMADB_URL=http://localhost:8000

# Production settings
NODE_ENV=production
OPENROUTER_REFERER=https://your-production-domain.com
```

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. In a separate terminal, start the backend server:
   ```bash
   node server/index.js
   ```

## Production Deployment

### Deploying to Heroku

1. Create a new Heroku app:
   ```bash
   heroku create del-norte-course-selector
   ```

2. Set environment variables:
   ```bash
   heroku config:set REACT_APP_FIREBASE_API_KEY=your_api_key
   heroku config:set REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
   heroku config:set REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   heroku config:set REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   heroku config:set REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   heroku config:set REACT_APP_FIREBASE_APP_ID=your_app_id
   heroku config:set REACT_APP_OPENROUTER_API_KEY=your_api_key
   heroku config:set NODE_ENV=production
   heroku config:set OPENROUTER_REFERER=https://your-app-name.herokuapp.com
   ```

3. Deploy to Heroku:
   ```bash
   git push heroku main
   ```

### Deploying to Vercel

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy to Vercel:
   ```bash
   vercel
   ```

3. Add environment variables in the Vercel dashboard.

4. For production deployment:
   ```bash
   vercel --prod
   ```

## API Documentation

### PDF Processing Endpoints

- `GET /api/pdf`: Fetch the course catalog PDF
- `POST /api/pdf/content`: Store extracted PDF content
- `GET /api/pdf/search`: Search through PDF content

### Chat Endpoints

- `POST /api/chat`: Send a query to Claude AI

### Health Check

- `GET /health`: Check server status and course data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
