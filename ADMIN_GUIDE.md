# Admin Panel Guide

## Overview

The Admin Panel allows authorized administrators to upload new course catalog PDFs and regenerate embeddings for the AI-powered course selection assistant. This ensures the application stays up-to-date with the latest course offerings each academic year.

## Features

### 1. System Status Dashboard
- View real-time system health metrics
- Monitor PDF content status
- Check vector search availability
- Track total vector count and content length

### 2. Course Catalog Upload
- Upload new PDF course catalogs (up to 50MB)
- Automatic PDF processing and text extraction
- Embeddings generation for AI-powered search
- Progress tracking during upload and processing

### 3. Cache Management
- Clear embeddings cache to force regeneration
- Useful for troubleshooting search issues
- Helps when updating to new catalog versions

## Accessing the Admin Panel

### Prerequisites
1. You must have an admin account
2. Your user account must have the `role: 'admin'` field in Firestore

### Setting Up Admin Access

1. **Create a user account** through the normal signup process
2. **Grant admin privileges** in Firebase Console:
   - Go to Firebase Console → Firestore Database
   - Navigate to the `users` collection
   - Find your user document (by UID)
   - Add or update the `role` field to `'admin'`

3. **Access the Admin Panel**:
   - Log in to the application
   - Click the "Admin Panel" button in the header (only visible to admins)
   - Or navigate directly to `/admin`

## Uploading a New Course Catalog

### Step-by-Step Process

1. **Navigate to Admin Panel**
   - Click "Admin Panel" button in the header
   - Or go to `https://your-domain.com/admin`

2. **Select PDF File**
   - Click "Choose File" under "Upload New Course Catalog"
   - Select your course catalog PDF (must be .pdf format)
   - File size limit: 50MB

3. **Upload and Process**
   - Click "Upload and Process" button
   - The system will:
     - Upload the PDF to the server
     - Extract text content from the PDF
     - Generate embeddings for semantic search
     - Update the vector database

4. **Monitor Progress**
   - Watch the progress bar during upload
   - Processing may take several minutes depending on PDF size
   - Do not close the browser during this process

5. **Verify Success**
   - Check for success message
   - Review updated system status
   - Test the chat interface with course queries

## How It Works

### Backend Architecture

```
1. PDF Upload (POST /api/admin/upload-catalog)
   ↓
2. Save to /uploads directory
   ↓
3. Copy to current-catalog.pdf
   ↓
4. Embeddings Generation (POST /api/admin/regenerate-embeddings)
   ↓
5. Clear existing vectors and cache
   ↓
6. Extract text from PDF
   ↓
7. Split text into chunks (1000 chars with 200 char overlap)
   ↓
8. Generate embeddings using Claude AI
   ↓
9. Store vectors in memory
   ↓
10. Save embeddings cache to disk
```

### File Storage

- **Uploaded PDFs**: Stored in `/uploads` directory with timestamp
- **Current Catalog**: Copied to `current-catalog.pdf` in root
- **Embeddings Cache**: Saved to `embeddings-cache.json`

### Embeddings Generation

- Uses Claude AI via OpenRouter API
- Generates semantic vector embeddings for each text chunk
- Enables intelligent course search and recommendations
- Cached to reduce API calls and improve performance

## Troubleshooting

### Upload Fails

**Problem**: PDF upload returns an error

**Solutions**:
- Ensure PDF is valid and not corrupted
- Check file size (must be under 50MB)
- Verify file format is `.pdf`
- Check server logs for detailed error messages

### Embeddings Generation Fails

**Problem**: Upload succeeds but embeddings generation fails

**Solutions**:
- Verify OpenRouter API key is configured
- Check API rate limits
- Review server logs for API errors
- Try clearing cache and regenerating

### Search Not Working After Upload

**Problem**: New catalog uploaded but search returns old results

**Solutions**:
1. Clear embeddings cache via Admin Panel
2. Regenerate embeddings
3. Restart the server
4. Clear browser cache

### Admin Panel Not Accessible

**Problem**: Cannot see Admin Panel button or access `/admin`

**Solutions**:
- Verify your user has `role: 'admin'` in Firestore
- Log out and log back in
- Check browser console for errors
- Verify Firebase authentication is working

## Best Practices

### Annual Catalog Updates

1. **Timing**: Upload new catalogs before course selection period
2. **Testing**: Test in development environment first
3. **Backup**: Keep previous catalog PDF as backup
4. **Verification**: Test search functionality after upload
5. **Communication**: Notify users of catalog updates

### Cache Management

- Clear cache when uploading new catalogs
- Clear cache if search results seem outdated
- Monitor cache size in system status
- Cache is automatically saved after embeddings generation

### Security

- Limit admin access to trusted personnel only
- Regularly audit admin user list in Firestore
- Monitor upload activity through server logs
- Use strong passwords for admin accounts

## API Endpoints

### Admin Routes (Protected)

```
POST /api/admin/upload-catalog
- Upload new course catalog PDF
- Requires: multipart/form-data with 'pdf' field
- Returns: { success, message, filename, size }

POST /api/admin/regenerate-embeddings
- Regenerate embeddings from current catalog
- Returns: { success, message, vectorCount, cacheStats }

POST /api/admin/clear-cache
- Clear embeddings cache
- Returns: { success, message, clearedEntries }

GET /api/admin/catalog-info
- Get current catalog information
- Returns: { exists, size, modified, vectorCount, cacheStats }
```

## Environment Variables

No additional environment variables are required for the admin panel. It uses the existing OpenRouter API key:

```env
REACT_APP_OPENROUTER_API_KEY=your_api_key
```

## File Structure

```
del-norte-course-selector/
├── server/
│   └── routes/
│       └── admin.js          # Admin API routes
├── src/
│   └── components/
│       └── admin/
│           └── AdminPanel.tsx # Admin UI component
├── uploads/                   # Uploaded PDFs (gitignored)
├── current-catalog.pdf        # Active catalog (gitignored)
└── embeddings-cache.json      # Cached embeddings (committed)
```

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Review this guide for troubleshooting steps
3. Contact the development team
4. Report bugs using the `/reportbug` command in the app

## Future Enhancements

Potential improvements for future versions:
- Multiple catalog version management
- Scheduled automatic updates
- Catalog comparison tools
- Analytics on catalog usage
- Bulk user management
- Audit logs for admin actions
