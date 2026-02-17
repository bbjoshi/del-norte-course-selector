const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFService = require('../services/PDFService');
const VectorSearchService = require('../services/VectorSearchService');
const DatabaseService = require('../services/DatabaseService');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Save with timestamp to avoid conflicts
    const timestamp = Date.now();
    cb(null, `course-catalog-${timestamp}.pdf`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

/**
 * @route POST /api/admin/upload-catalog
 * @desc Upload a new course catalog PDF
 */
router.post('/upload-catalog', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }

    console.log('PDF uploaded successfully:', req.file.filename);
    
    // Read the uploaded file
    const pdfBuffer = fs.readFileSync(req.file.path);
    
    // Store the PDF path for future use
    const catalogPath = path.join(__dirname, '..', '..', 'current-catalog.pdf');
    fs.copyFileSync(req.file.path, catalogPath);
    
    console.log('PDF saved as current catalog');
    
    res.json({ 
      success: true, 
      message: 'PDF uploaded successfully',
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading catalog:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to upload catalog',
      details: error.message 
    });
  }
});

/**
 * @route POST /api/admin/regenerate-embeddings
 * @desc Regenerate embeddings from the current catalog
 */
router.post('/regenerate-embeddings', async (req, res) => {
  try {
    console.log('Starting embeddings regeneration...');
    
    // Clear existing vectors and cache
    VectorSearchService.clearCache();
    VectorSearchService.clearVectors();
    
    console.log('Cleared existing vectors and cache');
    
    // Read the current catalog
    const catalogPath = path.join(__dirname, '..', '..', 'current-catalog.pdf');
    
    if (!fs.existsSync(catalogPath)) {
      return res.status(404).json({ 
        success: false, 
        error: 'No catalog file found. Please upload a catalog first.' 
      });
    }
    
    const pdfBuffer = fs.readFileSync(catalogPath);
    console.log('Read catalog PDF, size:', pdfBuffer.length);
    
    // Process PDF and generate embeddings
    const success = await PDFService.processPDFForVectorDB(pdfBuffer);
    
    if (!success) {
      throw new Error('Failed to process PDF and generate embeddings');
    }
    
    const vectorCount = VectorSearchService.getVectorCount();
    console.log(`Embeddings regeneration completed. Vector count: ${vectorCount}`);
    
    // Save the cache
    VectorSearchService.saveCache();
    
    res.json({ 
      success: true, 
      message: 'Embeddings regenerated successfully',
      vectorCount: vectorCount,
      cacheStats: VectorSearchService.getCacheStats()
    });
  } catch (error) {
    console.error('Error regenerating embeddings:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to regenerate embeddings',
      details: error.message 
    });
  }
});

/**
 * @route POST /api/admin/clear-cache
 * @desc Clear the embeddings cache
 */
router.post('/clear-cache', (req, res) => {
  try {
    const clearedEntries = VectorSearchService.clearCache();
    
    // Also delete the cache file
    const cachePath = path.join(__dirname, '..', '..', 'embeddings-cache.json');
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
      console.log('Deleted cache file');
    }
    
    res.json({ 
      success: true, 
      message: 'Cache cleared successfully',
      clearedEntries: clearedEntries
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear cache',
      details: error.message 
    });
  }
});

/**
 * @route GET /api/admin/catalog-info
 * @desc Get information about the current catalog
 */
router.get('/catalog-info', (req, res) => {
  try {
    const catalogPath = path.join(__dirname, '..', '..', 'current-catalog.pdf');
    
    if (!fs.existsSync(catalogPath)) {
      return res.json({ 
        exists: false,
        message: 'No catalog file found'
      });
    }
    
    const stats = fs.statSync(catalogPath);
    
    res.json({ 
      exists: true,
      size: stats.size,
      modified: stats.mtime,
      vectorCount: VectorSearchService.getVectorCount(),
      cacheStats: VectorSearchService.getCacheStats()
    });
  } catch (error) {
    console.error('Error getting catalog info:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get catalog info',
      details: error.message 
    });
  }
});

/**
 * @route GET /api/admin/analytics
 * @desc Get usage analytics summary
 */
router.get('/analytics', (req, res) => {
  try {
    const analytics = DatabaseService.getAnalyticsSummary();
    res.json({ success: true, analytics });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch analytics',
      details: error.message 
    });
  }
});

module.exports = router;
