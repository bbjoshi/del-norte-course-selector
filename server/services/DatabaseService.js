const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

/**
 * SQLite Database Service for persistent storage of embeddings, chat history, and feedback
 */
class DatabaseService {
  constructor() {
    const dbPath = path.join(__dirname, '..', '..', 'data', 'app.db');
    
    // Ensure data directory exists
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    this.db = new Database(dbPath);
    
    // Enable WAL mode for better concurrent read performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    
    this.initializeTables();
    console.log(`SQLite database initialized at ${dbPath}`);
  }

  initializeTables() {
    this.db.exec(`
      -- Embeddings cache table
      CREATE TABLE IF NOT EXISTS embeddings_cache (
        text_hash TEXT PRIMARY KEY,
        embedding TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Vector store table (persisted embeddings with text)
      CREATE TABLE IF NOT EXISTS vectors (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        embedding TEXT NOT NULL,
        document_type TEXT DEFAULT 'unknown',
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Chat sessions table
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'New Chat',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Chat messages table
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        text TEXT NOT NULL,
        sender TEXT NOT NULL CHECK(sender IN ('user', 'bot')),
        query_text TEXT,
        feedback_rating TEXT,
        feedback_comment TEXT,
        feedback_submitted INTEGER DEFAULT 0,
        timestamp TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
      );

      -- Feedback table
      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL,
        session_id TEXT,
        query TEXT,
        response TEXT,
        rating TEXT NOT NULL CHECK(rating IN ('positive', 'negative')),
        comment TEXT,
        timestamp TEXT DEFAULT (datetime('now'))
      );

      -- Index for faster lookups
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_vectors_doc_type ON vectors(document_type);
      CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating);
    `);
  }

  // === EMBEDDINGS CACHE ===

  getCachedEmbedding(textHash) {
    const row = this.db.prepare('SELECT embedding FROM embeddings_cache WHERE text_hash = ?').get(textHash);
    return row ? JSON.parse(row.embedding) : null;
  }

  setCachedEmbedding(textHash, embedding) {
    this.db.prepare(
      'INSERT OR REPLACE INTO embeddings_cache (text_hash, embedding) VALUES (?, ?)'
    ).run(textHash, JSON.stringify(embedding));
  }

  getCacheSize() {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM embeddings_cache').get();
    return row.count;
  }

  clearEmbeddingsCache() {
    const info = this.db.prepare('DELETE FROM embeddings_cache').run();
    return info.changes;
  }

  // === VECTOR STORE ===

  getVectors() {
    const rows = this.db.prepare('SELECT id, text, embedding, document_type FROM vectors').all();
    return rows.map(row => ({
      id: row.id,
      text: row.text,
      embedding: JSON.parse(row.embedding),
      documentType: row.document_type,
    }));
  }

  getVectorCount() {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM vectors').get();
    return row.count;
  }

  addVectors(vectors, documentType = 'unknown') {
    const insert = this.db.prepare(
      'INSERT OR REPLACE INTO vectors (id, text, embedding, document_type) VALUES (?, ?, ?, ?)'
    );
    
    const insertMany = this.db.transaction((vectors) => {
      for (const v of vectors) {
        insert.run(v.id, v.text, JSON.stringify(v.embedding), documentType);
      }
    });
    
    insertMany(vectors);
    return vectors.length;
  }

  clearVectors() {
    const info = this.db.prepare('DELETE FROM vectors').run();
    return info.changes;
  }

  hasVectorsForDocument(documentType) {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM vectors WHERE document_type = ?').get(documentType);
    return row.count > 0;
  }

  // === CHAT SESSIONS ===

  createSession(id, title) {
    this.db.prepare(
      `INSERT OR REPLACE INTO chat_sessions (id, title, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))`
    ).run(id, title);
    return id;
  }

  updateSessionTitle(id, title) {
    this.db.prepare(
      `UPDATE chat_sessions SET title = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(title, id);
  }

  getSessions() {
    return this.db.prepare(
      'SELECT * FROM chat_sessions ORDER BY updated_at DESC'
    ).all();
  }

  getSession(id) {
    return this.db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id);
  }

  deleteSession(id) {
    this.db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(id);
  }

  // === CHAT MESSAGES ===

  addMessage(messageData) {
    const { id, sessionId, text, sender, queryText, timestamp } = messageData;
    
    // Ensure session exists
    const session = this.getSession(sessionId);
    if (!session) {
      this.createSession(sessionId, 'New Chat');
    }
    
    this.db.prepare(
      `INSERT OR REPLACE INTO chat_messages 
       (id, session_id, text, sender, query_text, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, sessionId, text, sender, queryText || null, timestamp);
    
    // Update session timestamp and title
    if (sender === 'user') {
      const title = text.length > 50 ? text.slice(0, 50) + '...' : text;
      // Only update title if this is the first user message
      const existingUserMsg = this.db.prepare(
        'SELECT COUNT(*) as count FROM chat_messages WHERE session_id = ? AND sender = "user"'
      ).get(sessionId);
      
      if (existingUserMsg.count <= 1) {
        this.updateSessionTitle(sessionId, title);
      }
    }
    
    this.db.prepare(`UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?`).run(sessionId);
  }

  getMessages(sessionId) {
    return this.db.prepare(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC'
    ).all(sessionId);
  }

  updateMessageFeedback(messageId, rating, comment, submitted) {
    this.db.prepare(
      `UPDATE chat_messages 
       SET feedback_rating = ?, feedback_comment = ?, feedback_submitted = ? 
       WHERE id = ?`
    ).run(rating, comment, submitted ? 1 : 0, messageId);
  }

  // === FEEDBACK ===

  addFeedback(feedbackData) {
    const { messageId, sessionId, query, response, rating, comment, timestamp } = feedbackData;
    this.db.prepare(
      `INSERT INTO feedback (message_id, session_id, query, response, rating, comment, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(messageId, sessionId || null, query, response, rating, comment || null, timestamp);
  }

  getFeedback(limit = 100) {
    return this.db.prepare(
      'SELECT * FROM feedback ORDER BY timestamp DESC LIMIT ?'
    ).all(limit);
  }

  getFeedbackStats() {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN rating = 'positive' THEN 1 ELSE 0 END) as positive,
        SUM(CASE WHEN rating = 'negative' THEN 1 ELSE 0 END) as negative
      FROM feedback
    `).get();
    return stats;
  }

  // === UTILITY ===

  close() {
    this.db.close();
  }
}

// Export as singleton
module.exports = new DatabaseService();
