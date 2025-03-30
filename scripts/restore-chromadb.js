#!/usr/bin/env node

/**
 * ChromaDB Restore Script
 * 
 * This script restores data to ChromaDB collections from JSON backup files.
 * 
 * Usage:
 *   node restore-chromadb.js <backup-file>
 * 
 * Arguments:
 *   backup-file: Path to the backup JSON file
 */

const { ChromaClient } = require('chromadb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configuration
const CHROMADB_URL = process.env.CHROMADB_URL || 'http://localhost:8000';

/**
 * Parse command line arguments
 */
function parseArgs() {
  if (process.argv.length < 3) {
    console.error('Error: Missing backup file path');
    console.error('Usage: node restore-chromadb.js <backup-file>');
    process.exit(1);
  }
  
  const backupFile = process.argv[2];
  
  if (!fs.existsSync(backupFile)) {
    console.error(`Error: Backup file not found: ${backupFile}`);
    process.exit(1);
  }
  
  return { backupFile };
}

/**
 * Load backup data from file
 */
function loadBackupData(filePath) {
  try {
    console.log(`Loading backup data from: ${filePath}`);
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading backup data:', error);
    process.exit(1);
  }
}

/**
 * Extract collection name from backup filename
 */
function extractCollectionName(filePath) {
  const filename = path.basename(filePath);
  // Assuming filename format: collection_name_timestamp.json
  const match = filename.match(/^([^_]+)_/);
  return match ? match[1] : 'course_catalog'; // Default to course_catalog if pattern doesn't match
}

/**
 * Restore data to a collection
 */
async function restoreCollection(client, collectionName, backupData) {
  console.log(`Restoring collection: ${collectionName}`);
  
  try {
    // Check if collection exists
    const collections = await client.listCollections();
    const collectionExists = collections.some(c => c.name === collectionName);
    
    let collection;
    
    try {
      if (collectionExists) {
        console.log(`Collection ${collectionName} already exists, getting reference...`);
        collection = await client.getCollection({
          name: collectionName
        });
        
        // Get count of existing vectors
        const count = await collection.count();
        console.log(`Collection has ${count} existing vectors`);
        
        if (count > 0) {
          const proceed = await confirmOverwrite(collectionName, count);
          if (!proceed) {
            console.log('Restore cancelled by user');
            return { success: false, reason: 'cancelled' };
          }
        }
      } else {
        console.log(`Creating new collection: ${collectionName}`);
        collection = await client.createCollection({
          name: collectionName,
          metadata: { description: 'Del Norte High School Course Catalog' }
        });
      }
    } catch (collectionError) {
      // Handle the case where collection already exists but wasn't listed
      if (collectionError.message && collectionError.message.includes('already exists')) {
        console.log('Collection already exists but wasn\'t listed, getting collection...');
        collection = await client.getCollection({
          name: collectionName
        });
        
        // Get count of existing vectors
        const count = await collection.count();
        console.log(`Collection has ${count} existing vectors`);
      } else {
        throw collectionError;
      }
    }
    
    // Check if backup data has the expected format
    if (!backupData.ids) {
      console.error('Invalid backup data format');
      return { success: false, reason: 'invalid_format' };
    }
    
    // Prepare data for ChromaDB
    const ids = backupData.ids;
    const documents = backupData.documents || ids.map(() => '');
    const embeddings = backupData.embeddings || null;
    const metadatas = backupData.metadatas || ids.map(() => ({}));
    
    // Add vectors to ChromaDB
    await collection.add({
      ids,
      embeddings,
      metadatas: metadatas || ids.map(() => ({})),
      documents
    });
    
    console.log(`Successfully restored ${ids.length} vectors to collection ${collectionName}`);
    return { success: true, count: ids.length };
  } catch (error) {
    console.error(`Error restoring collection ${collectionName}:`, error);
    return { success: false, error };
  }
}

/**
 * Confirm overwrite of existing collection
 * In a script, we'll assume yes, but this function could be modified
 * to prompt the user in an interactive environment
 */
async function confirmOverwrite(collectionName, count) {
  console.log(`Warning: Collection ${collectionName} already has ${count} vectors.`);
  console.log('Proceeding will add vectors from the backup, potentially causing duplicates.');
  
  // In a non-interactive script, we'll just proceed
  // In an interactive environment, you could add a prompt here
  return true;
}

/**
 * Main restore function
 */
async function restoreChromaDB() {
  const { backupFile } = parseArgs();
  
  console.log(`Starting ChromaDB restore...`);
  console.log(`ChromaDB URL: ${CHROMADB_URL}`);
  console.log(`Backup file: ${backupFile}`);
  
  // Load backup data
  const backupData = loadBackupData(backupFile);
  
  // Extract collection name from filename
  const collectionName = extractCollectionName(backupFile);
  
  try {
    // Connect to ChromaDB
    const client = new ChromaClient({
      path: CHROMADB_URL
    });
    
    // Check if ChromaDB is available
    await client.heartbeat();
    console.log('ChromaDB is available');
    
    // Restore collection
    const result = await restoreCollection(client, collectionName, backupData);
    
    if (result.success) {
      console.log(`Restore completed successfully. Added ${result.count} vectors.`);
    } else {
      console.error(`Restore failed: ${result.reason || 'unknown error'}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error restoring ChromaDB:', error);
    process.exit(1);
  }
}

// Run the restore
restoreChromaDB().catch(error => {
  console.error('Unhandled error during restore:', error);
  process.exit(1);
});
