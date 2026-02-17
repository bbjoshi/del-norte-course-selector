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

      -- Analytics events table
      CREATE TABLE IF NOT EXISTS analytics_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        user_id TEXT,
        user_email TEXT,
        session_id TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- User sessions tracking table
      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_email TEXT,
        started_at TEXT NOT NULL,
        last_active_at TEXT NOT NULL,
        ended_at TEXT,
        duration_seconds INTEGER DEFAULT 0,
        questions_asked INTEGER DEFAULT 0,
        answers_received INTEGER DEFAULT 0
      );

      -- Index for faster lookups
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_vectors_doc_type ON vectors(document_type);
      CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_started ON user_sessions(started_at);
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
        "SELECT COUNT(*) as count FROM chat_messages WHERE session_id = ? AND sender = 'user'"
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

  // === ANALYTICS ===

  trackEvent(eventData) {
    const { eventType, userId, userEmail, sessionId, metadata } = eventData;
    this.db.prepare(
      `INSERT INTO analytics_events (event_type, user_id, user_email, session_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).run(eventType, userId || null, userEmail || null, sessionId || null, metadata ? JSON.stringify(metadata) : null);
  }

  // Start or update a user session
  startUserSession(sessionData) {
    const { id, userId, userEmail } = sessionData;
    const now = new Date().toISOString();
    this.db.prepare(
      `INSERT OR IGNORE INTO user_sessions (id, user_id, user_email, started_at, last_active_at, duration_seconds, questions_asked, answers_received)
       VALUES (?, ?, ?, ?, ?, 0, 0, 0)`
    ).run(id, userId, userEmail || null, now, now);
  }

  updateUserSessionActivity(sessionId) {
    const session = this.db.prepare('SELECT started_at FROM user_sessions WHERE id = ?').get(sessionId);
    if (session) {
      const now = new Date();
      const started = new Date(session.started_at);
      const durationSeconds = Math.floor((now.getTime() - started.getTime()) / 1000);
      this.db.prepare(
        `UPDATE user_sessions SET last_active_at = ?, duration_seconds = ? WHERE id = ?`
      ).run(now.toISOString(), durationSeconds, sessionId);
    }
  }

  endUserSession(sessionId) {
    const session = this.db.prepare('SELECT started_at FROM user_sessions WHERE id = ?').get(sessionId);
    if (session) {
      const now = new Date();
      const started = new Date(session.started_at);
      const durationSeconds = Math.floor((now.getTime() - started.getTime()) / 1000);
      this.db.prepare(
        `UPDATE user_sessions SET ended_at = ?, last_active_at = ?, duration_seconds = ? WHERE id = ?`
      ).run(now.toISOString(), now.toISOString(), durationSeconds, sessionId);
    }
  }

  incrementSessionQuestions(sessionId) {
    this.db.prepare(
      `UPDATE user_sessions SET questions_asked = questions_asked + 1, last_active_at = datetime('now') WHERE id = ?`
    ).run(sessionId);
  }

  incrementSessionAnswers(sessionId) {
    this.db.prepare(
      `UPDATE user_sessions SET answers_received = answers_received + 1, last_active_at = datetime('now') WHERE id = ?`
    ).run(sessionId);
  }

  // === ANALYTICS AGGREGATIONS ===

  getAnalyticsSummary() {
    // Total unique users (accounts)
    const totalAccounts = this.db.prepare(
      `SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE event_type = 'account_created'`
    ).get();

    // Signups over time (daily for last 30 days)
    const signupsByDay = this.db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count
      FROM analytics_events
      WHERE event_type = 'account_created'
        AND created_at >= datetime('now', '-30 days')
      GROUP BY date(created_at)
      ORDER BY day ASC
    `).all();

    // Total questions and answers
    const totalQuestions = this.db.prepare(
      `SELECT COUNT(*) as count FROM chat_messages WHERE sender = 'user'`
    ).get();
    const totalAnswers = this.db.prepare(
      `SELECT COUNT(*) as count FROM chat_messages WHERE sender = 'bot'`
    ).get();

    // Questions per day (last 30 days)
    const questionsByDay = this.db.prepare(`
      SELECT date(timestamp) as day, COUNT(*) as count
      FROM chat_messages
      WHERE sender = 'user'
        AND timestamp >= datetime('now', '-30 days')
      GROUP BY date(timestamp)
      ORDER BY day ASC
    `).all();

    // Total chat sessions and messages
    const totalChatSessions = this.db.prepare(
      `SELECT COUNT(*) as count FROM chat_sessions`
    ).get();

    // User session metrics
    const sessionStats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_sessions,
        ROUND(AVG(duration_seconds), 0) as avg_duration_seconds,
        MAX(duration_seconds) as max_duration_seconds,
        ROUND(AVG(questions_asked), 1) as avg_questions_per_session,
        SUM(questions_asked) as total_questions_tracked,
        SUM(answers_received) as total_answers_tracked
      FROM user_sessions
    `).get();

    // Active users today
    const activeToday = this.db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM analytics_events
      WHERE created_at >= datetime('now', 'start of day')
        AND user_id IS NOT NULL
    `).get();

    // Active users this week
    const activeThisWeek = this.db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM analytics_events
      WHERE created_at >= datetime('now', '-7 days')
        AND user_id IS NOT NULL
    `).get();

    // Active users this month
    const activeThisMonth = this.db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM analytics_events
      WHERE created_at >= datetime('now', '-30 days')
        AND user_id IS NOT NULL
    `).get();

    // Login count
    const totalLogins = this.db.prepare(
      `SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'login'`
    ).get();

    // Unique users who asked questions
    const uniqueQuestionUsers = this.db.prepare(
      `SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE event_type = 'question_asked' AND user_id IS NOT NULL`
    ).get();

    // Feedback stats
    const feedbackStats = this.getFeedbackStats();

    // Recent events
    const recentEvents = this.db.prepare(`
      SELECT * FROM analytics_events
      ORDER BY created_at DESC
      LIMIT 50
    `).all().map(e => ({
      ...e,
      metadata: e.metadata ? JSON.parse(e.metadata) : null
    }));

    // Session duration distribution
    const sessionDurationDistribution = this.db.prepare(`
      SELECT
        CASE
          WHEN duration_seconds < 60 THEN '< 1 min'
          WHEN duration_seconds < 300 THEN '1-5 min'
          WHEN duration_seconds < 900 THEN '5-15 min'
          WHEN duration_seconds < 1800 THEN '15-30 min'
          ELSE '30+ min'
        END as duration_bucket,
        COUNT(*) as count
      FROM user_sessions
      WHERE duration_seconds > 0
      GROUP BY duration_bucket
      ORDER BY MIN(duration_seconds)
    `).all();

    // Top users by questions
    const topUsersByQuestions = this.db.prepare(`
      SELECT user_email, user_id, COUNT(*) as question_count
      FROM analytics_events
      WHERE event_type = 'question_asked' AND user_email IS NOT NULL
      GROUP BY user_id
      ORDER BY question_count DESC
      LIMIT 10
    `).all();

    return {
      accounts: {
        total: totalAccounts.count,
        signupsByDay,
      },
      questions: {
        total: totalQuestions.count,
        byDay: questionsByDay,
        uniqueUsers: uniqueQuestionUsers.count,
      },
      answers: {
        total: totalAnswers.count,
      },
      chatSessions: {
        total: totalChatSessions.count,
      },
      userSessions: {
        total: sessionStats.total_sessions,
        avgDurationSeconds: sessionStats.avg_duration_seconds || 0,
        maxDurationSeconds: sessionStats.max_duration_seconds || 0,
        avgQuestionsPerSession: sessionStats.avg_questions_per_session || 0,
        durationDistribution: sessionDurationDistribution,
      },
      activeUsers: {
        today: activeToday.count,
        thisWeek: activeThisWeek.count,
        thisMonth: activeThisMonth.count,
      },
      logins: {
        total: totalLogins.count,
      },
      feedback: feedbackStats,
      topUsersByQuestions,
      recentEvents,
    };
  }

  // === UTILITY ===

  close() {
    this.db.close();
  }
}

// Export as singleton
module.exports = new DatabaseService();
