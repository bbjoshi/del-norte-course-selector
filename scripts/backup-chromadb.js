#!/usr/bin/env node

/**
 * ChromaDB Backup Script
 * 
 * This script exports data from ChromaDB collections to JSON files.
 * It can be run manually or as a scheduled job.
 * 
 * Usage:
 *   node backup-chromadb.js [output-dir]
 * 
 * Arguments:
 *   output-dir: Optional directory to store backups (default: ./backups)
 */

const { ChromaClient } = require('chromadb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configuration
const CHROMADB_URL = process.env.CHROMADB_URL || 'http://localhost:8000';
const OUTPUT_DIR = process.argv[2] || path.join(__dirname, '..', 'backups');
const COLLECTION_NAME = 'course_catalog'; // Default collection name

/**
 * Ensure the output directory exists
 */
function ensureDirectoryExists(directory) {
  if (!fs.existsSync(directory)) {
    console.log(`Creating directory: ${directory}`);
    fs.mkdirSync(directory, { recursive: true });
  }
}

/**
 * Backup a single collection
 */
async function backupCollection(client, collectionName) {
  console.log(`Backing up collection: ${collectionName}`);
  
  try {
    // Get the collection
    const collection = await client.getCollection({
      name: collectionName
    });
    
    // Get all data from the collection
    const data = await collection.get();
    
    // Generate timestamp for the filename
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `${collectionName}_${timestamp}.json`;
    const filePath = path.join(OUTPUT_DIR, filename);
    
    // Write data to file
    fs.writeFileSync(
      filePath,
      JSON.stringify(data, null, 2)
    );
    
    console.log(`Backup saved to: ${filePath}`);
    return { success: true, path: filePath };
  } catch (error) {
    console.error(`Error backing up collection ${collectionName}:`, error);
    return { success: false, error };
  }
}

/**
 * Main backup function
 */
async function backupChromaDB() {
  console.log(`Starting ChromaDB backup...`);
  console.log(`ChromaDB URL: ${CHROMADB_URL}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  
  // Ensure output directory exists
  ensureDirectoryExists(OUTPUT_DIR);
  
  try {
    // Connect to ChromaDB
    const client = new ChromaClient({
      path: CHROMADB_URL
    });
    
    // Check if ChromaDB is available
    await client.heartbeat();
    console.log('ChromaDB is available');
    
    // Get all collections
    const collections = await client.listCollections();
    console.log(`Found ${collections.length} collections`);
    
    if (collections.length === 0) {
      // If no collections found, try to backup the default collection
      console.log(`No collections found, trying to backup default collection: ${COLLECTION_NAME}`);
      await backupCollection(client, COLLECTION_NAME);
    } else {
      // Backup each collection
      for (const collectionInfo of collections) {
        console.log(`Collection info: ${JSON.stringify(collectionInfo)}`);
        // Extract the name from the collection info
        const name = collectionInfo.name || COLLECTION_NAME;
        await backupCollection(client, name);
      }
    }
    
    console.log('Backup completed successfully');
  } catch (error) {
    console.error('Error backing up ChromaDB:', error);
    process.exit(1);
  }
}

// Run the backup
backupChromaDB().catch(error => {
  console.error('Unhandled error during backup:', error);
  process.exit(1);
});
