const { createClient } = require('@libsql/client');

/**
 * Database Service — uses Turso (libsql) for cloud-persistent SQLite.
 *
 * Env vars:
 *   TURSO_DATABASE_URL  — libsql://... for Turso cloud, or file:/path for local
 *   TURSO_AUTH_TOKEN    — Turso auth token (not needed for local file URLs)
 *
 * Falls back to a local /tmp file when TURSO_DATABASE_URL is not set (e.g. dev).
 */
class DatabaseService {
  constructor() {
    const url = process.env.TURSO_DATABASE_URL || 'file:/tmp/del-norte-app.db';
    const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

    this.client = createClient({ url, authToken });

    // Kick off table creation; every public method awaits _ready() before use
    this._initPromise = this._initializeTables()
      .then(() => console.log(`Database initialized (${url.startsWith('libsql://') ? 'Turso cloud' : url})`))
      .catch(err => console.error('Database initialization failed:', err.message));
  }

  /** Await this inside every public method to ensure tables exist */
  async _ready() {
    await this._initPromise;
  }

  async _initializeTables() {
    // Run all DDL as a batch so it's atomic
    await this.client.batch([
      `CREATE TABLE IF NOT EXISTS embeddings_cache (
        text_hash TEXT PRIMARY KEY,
        embedding TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS vectors (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        embedding TEXT NOT NULL,
        document_type TEXT DEFAULT 'unknown',
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'New Chat',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        text TEXT NOT NULL,
        sender TEXT NOT NULL,
        query_text TEXT,
        feedback_rating TEXT,
        feedback_comment TEXT,
        feedback_submitted INTEGER DEFAULT 0,
        timestamp TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL,
        session_id TEXT,
        query TEXT,
        response TEXT,
        rating TEXT NOT NULL,
        comment TEXT,
        timestamp TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS analytics_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        user_id TEXT,
        user_email TEXT,
        session_id TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_email TEXT,
        started_at TEXT NOT NULL,
        last_active_at TEXT NOT NULL,
        ended_at TEXT,
        duration_seconds INTEGER DEFAULT 0,
        questions_asked INTEGER DEFAULT 0,
        answers_received INTEGER DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id)`,
      `CREATE INDEX IF NOT EXISTS idx_vectors_doc_type ON vectors(document_type)`,
      `CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating)`,
      `CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type)`,
      `CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_user_sessions_started ON user_sessions(started_at)`,
    ], 'write');
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  async _get(sql, args = []) {
    const result = await this.client.execute({ sql, args });
    return result.rows[0] || null;
  }

  async _all(sql, args = []) {
    const result = await this.client.execute({ sql, args });
    return result.rows;
  }

  async _run(sql, args = []) {
    const result = await this.client.execute({ sql, args });
    return { changes: result.rowsAffected, lastInsertRowid: result.lastInsertRowid };
  }

  // ─── EMBEDDINGS CACHE ────────────────────────────────────────────────────────

  async getCachedEmbedding(textHash) {
    await this._ready();
    const row = await this._get('SELECT embedding FROM embeddings_cache WHERE text_hash = ?', [textHash]);
    return row ? JSON.parse(row.embedding) : null;
  }

  async setCachedEmbedding(textHash, embedding) {
    await this._ready();
    await this._run(
      'INSERT OR REPLACE INTO embeddings_cache (text_hash, embedding) VALUES (?, ?)',
      [textHash, JSON.stringify(embedding)]
    );
  }

  async getCacheSize() {
    await this._ready();
    const row = await this._get('SELECT COUNT(*) as count FROM embeddings_cache');
    return row ? Number(row.count) : 0;
  }

  async clearEmbeddingsCache() {
    await this._ready();
    const info = await this._run('DELETE FROM embeddings_cache');
    return info.changes;
  }

  // ─── VECTOR STORE ────────────────────────────────────────────────────────────

  async getVectors() {
    await this._ready();
    const rows = await this._all('SELECT id, text, embedding, document_type FROM vectors');
    return rows.map(row => ({
      id: row.id,
      text: row.text,
      embedding: JSON.parse(row.embedding),
      documentType: row.document_type,
    }));
  }

  async getVectorCount() {
    await this._ready();
    const row = await this._get('SELECT COUNT(*) as count FROM vectors');
    return row ? Number(row.count) : 0;
  }

  async addVectors(vectors, documentType = 'unknown') {
    await this._ready();
    if (!vectors || vectors.length === 0) return 0;
    const statements = vectors.map(v => ({
      sql: 'INSERT OR REPLACE INTO vectors (id, text, embedding, document_type) VALUES (?, ?, ?, ?)',
      args: [v.id, v.text, JSON.stringify(v.embedding), documentType],
    }));
    await this.client.batch(statements, 'write');
    return vectors.length;
  }

  async clearVectors() {
    await this._ready();
    const info = await this._run('DELETE FROM vectors');
    return info.changes;
  }

  async hasVectorsForDocument(documentType) {
    await this._ready();
    const row = await this._get('SELECT COUNT(*) as count FROM vectors WHERE document_type = ?', [documentType]);
    return row ? Number(row.count) > 0 : false;
  }

  // ─── CHAT SESSIONS ───────────────────────────────────────────────────────────

  async createSession(id, title) {
    await this._ready();
    await this._run(
      `INSERT OR REPLACE INTO chat_sessions (id, title, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))`,
      [id, title]
    );
    return id;
  }

  async updateSessionTitle(id, title) {
    await this._ready();
    await this._run(
      `UPDATE chat_sessions SET title = ?, updated_at = datetime('now') WHERE id = ?`,
      [title, id]
    );
  }

  async getSessions() {
    await this._ready();
    return this._all('SELECT * FROM chat_sessions ORDER BY updated_at DESC');
  }

  async getSession(id) {
    await this._ready();
    return this._get('SELECT * FROM chat_sessions WHERE id = ?', [id]);
  }

  async deleteSession(id) {
    await this._ready();
    // Manually cascade delete messages (Turso/libsql may not enforce FK cascades)
    await this.client.batch([
      { sql: 'DELETE FROM chat_messages WHERE session_id = ?', args: [id] },
      { sql: 'DELETE FROM chat_sessions WHERE id = ?', args: [id] },
    ], 'write');
  }

  // ─── CHAT MESSAGES ───────────────────────────────────────────────────────────

  async addMessage(messageData) {
    await this._ready();
    const { id, sessionId, text, sender, queryText, timestamp } = messageData;

    // Ensure session exists
    const session = await this.getSession(sessionId);
    if (!session) {
      await this.createSession(sessionId, 'New Chat');
    }

    await this._run(
      `INSERT OR REPLACE INTO chat_messages (id, session_id, text, sender, query_text, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, sessionId, text, sender, queryText || null, timestamp]
    );

    // Update session title from first user message
    if (sender === 'user') {
      const countRow = await this._get(
        "SELECT COUNT(*) as count FROM chat_messages WHERE session_id = ? AND sender = 'user'",
        [sessionId]
      );
      if (countRow && Number(countRow.count) <= 1) {
        const title = text.length > 50 ? text.slice(0, 50) + '...' : text;
        await this.updateSessionTitle(sessionId, title);
      }
    }

    await this._run(`UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?`, [sessionId]);
  }

  async getMessages(sessionId) {
    await this._ready();
    return this._all('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC', [sessionId]);
  }

  async updateMessageFeedback(messageId, rating, comment, submitted) {
    await this._ready();
    await this._run(
      `UPDATE chat_messages SET feedback_rating = ?, feedback_comment = ?, feedback_submitted = ? WHERE id = ?`,
      [rating, comment, submitted ? 1 : 0, messageId]
    );
  }

  // ─── FEEDBACK ────────────────────────────────────────────────────────────────

  async addFeedback(feedbackData) {
    await this._ready();
    const { messageId, sessionId, query, response, rating, comment, timestamp } = feedbackData;
    await this._run(
      `INSERT INTO feedback (message_id, session_id, query, response, rating, comment, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [messageId, sessionId || null, query, response, rating, comment || null, timestamp]
    );
  }

  async getFeedback(limit = 100) {
    await this._ready();
    return this._all('SELECT * FROM feedback ORDER BY timestamp DESC LIMIT ?', [limit]);
  }

  async getFeedbackStats() {
    await this._ready();
    const row = await this._get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN rating = 'positive' THEN 1 ELSE 0 END) as positive,
        SUM(CASE WHEN rating = 'negative' THEN 1 ELSE 0 END) as negative
      FROM feedback
    `);
    return {
      total: row ? Number(row.total) : 0,
      positive: row ? Number(row.positive) : 0,
      negative: row ? Number(row.negative) : 0,
    };
  }

  // ─── ANALYTICS ───────────────────────────────────────────────────────────────

  async trackEvent(eventData) {
    await this._ready();
    const { eventType, userId, userEmail, sessionId, metadata } = eventData;
    await this._run(
      `INSERT INTO analytics_events (event_type, user_id, user_email, session_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [eventType, userId || null, userEmail || null, sessionId || null, metadata ? JSON.stringify(metadata) : null]
    );
  }

  async startUserSession(sessionData) {
    await this._ready();
    const { id, userId, userEmail } = sessionData;
    const now = new Date().toISOString();
    await this._run(
      `INSERT OR IGNORE INTO user_sessions (id, user_id, user_email, started_at, last_active_at, duration_seconds, questions_asked, answers_received) VALUES (?, ?, ?, ?, ?, 0, 0, 0)`,
      [id, userId, userEmail || null, now, now]
    );
  }

  async updateUserSessionActivity(sessionId) {
    await this._ready();
    const session = await this._get('SELECT started_at FROM user_sessions WHERE id = ?', [sessionId]);
    if (session) {
      const now = new Date();
      const started = new Date(session.started_at);
      const durationSeconds = Math.floor((now.getTime() - started.getTime()) / 1000);
      await this._run(
        `UPDATE user_sessions SET last_active_at = ?, duration_seconds = ? WHERE id = ?`,
        [now.toISOString(), durationSeconds, sessionId]
      );
    }
  }

  async endUserSession(sessionId) {
    await this._ready();
    const session = await this._get('SELECT started_at FROM user_sessions WHERE id = ?', [sessionId]);
    if (session) {
      const now = new Date();
      const started = new Date(session.started_at);
      const durationSeconds = Math.floor((now.getTime() - started.getTime()) / 1000);
      await this._run(
        `UPDATE user_sessions SET ended_at = ?, last_active_at = ?, duration_seconds = ? WHERE id = ?`,
        [now.toISOString(), now.toISOString(), durationSeconds, sessionId]
      );
    }
  }

  async incrementSessionQuestions(sessionId) {
    await this._ready();
    await this._run(
      `UPDATE user_sessions SET questions_asked = questions_asked + 1, last_active_at = datetime('now') WHERE id = ?`,
      [sessionId]
    );
  }

  async incrementSessionAnswers(sessionId) {
    await this._ready();
    await this._run(
      `UPDATE user_sessions SET answers_received = answers_received + 1, last_active_at = datetime('now') WHERE id = ?`,
      [sessionId]
    );
  }

  // ─── ANALYTICS AGGREGATIONS ──────────────────────────────────────────────────

  async getAnalyticsSummary() {
    await this._ready();

    const [
      totalAccountsRow,
      signupsByDay,
      totalQuestionsRow,
      totalAnswersRow,
      questionsByDay,
      totalChatSessionsRow,
      sessionStatsRow,
      activeTodayRow,
      activeThisWeekRow,
      activeThisMonthRow,
      totalLoginsRow,
      uniqueQuestionUsersRow,
      recentEvents,
      sessionDurationDistribution,
      topUsersByQuestions,
    ] = await Promise.all([
      this._get(`SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE event_type = 'account_created'`),
      this._all(`
        SELECT date(created_at) as day, COUNT(*) as count
        FROM analytics_events
        WHERE event_type = 'account_created' AND created_at >= datetime('now', '-30 days')
        GROUP BY date(created_at) ORDER BY day ASC
      `),
      this._get(`SELECT COUNT(*) as count FROM chat_messages WHERE sender = 'user'`),
      this._get(`SELECT COUNT(*) as count FROM chat_messages WHERE sender = 'bot'`),
      this._all(`
        SELECT date(timestamp) as day, COUNT(*) as count
        FROM chat_messages
        WHERE sender = 'user' AND timestamp >= datetime('now', '-30 days')
        GROUP BY date(timestamp) ORDER BY day ASC
      `),
      this._get(`SELECT COUNT(*) as count FROM chat_sessions`),
      this._get(`
        SELECT
          COUNT(*) as total_sessions,
          ROUND(AVG(duration_seconds), 0) as avg_duration_seconds,
          MAX(duration_seconds) as max_duration_seconds,
          ROUND(AVG(questions_asked), 1) as avg_questions_per_session
        FROM user_sessions
      `),
      this._get(`SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE created_at >= datetime('now', 'start of day') AND user_id IS NOT NULL`),
      this._get(`SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE created_at >= datetime('now', '-7 days') AND user_id IS NOT NULL`),
      this._get(`SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE created_at >= datetime('now', '-30 days') AND user_id IS NOT NULL`),
      this._get(`SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'login'`),
      this._get(`SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE event_type = 'question_asked' AND user_id IS NOT NULL`),
      this._all(`SELECT * FROM analytics_events ORDER BY created_at DESC LIMIT 50`),
      this._all(`
        SELECT
          CASE
            WHEN duration_seconds < 60 THEN '< 1 min'
            WHEN duration_seconds < 300 THEN '1-5 min'
            WHEN duration_seconds < 900 THEN '5-15 min'
            WHEN duration_seconds < 1800 THEN '15-30 min'
            ELSE '30+ min'
          END as duration_bucket,
          COUNT(*) as count
        FROM user_sessions WHERE duration_seconds > 0
        GROUP BY duration_bucket ORDER BY MIN(duration_seconds)
      `),
      this._all(`
        SELECT user_email, user_id, COUNT(*) as question_count
        FROM analytics_events
        WHERE event_type = 'question_asked' AND user_email IS NOT NULL
        GROUP BY user_id ORDER BY question_count DESC LIMIT 10
      `),
    ]);

    const feedbackStats = await this.getFeedbackStats();

    return {
      accounts: {
        total: Number(totalAccountsRow?.count || 0),
        signupsByDay: signupsByDay.map(r => ({ day: r.day, count: Number(r.count) })),
      },
      questions: {
        total: Number(totalQuestionsRow?.count || 0),
        byDay: questionsByDay.map(r => ({ day: r.day, count: Number(r.count) })),
        uniqueUsers: Number(uniqueQuestionUsersRow?.count || 0),
      },
      answers: {
        total: Number(totalAnswersRow?.count || 0),
      },
      chatSessions: {
        total: Number(totalChatSessionsRow?.count || 0),
      },
      userSessions: {
        total: Number(sessionStatsRow?.total_sessions || 0),
        avgDurationSeconds: Number(sessionStatsRow?.avg_duration_seconds || 0),
        maxDurationSeconds: Number(sessionStatsRow?.max_duration_seconds || 0),
        avgQuestionsPerSession: Number(sessionStatsRow?.avg_questions_per_session || 0),
        durationDistribution: sessionDurationDistribution.map(r => ({ duration_bucket: r.duration_bucket, count: Number(r.count) })),
      },
      activeUsers: {
        today: Number(activeTodayRow?.count || 0),
        thisWeek: Number(activeThisWeekRow?.count || 0),
        thisMonth: Number(activeThisMonthRow?.count || 0),
      },
      logins: {
        total: Number(totalLoginsRow?.count || 0),
      },
      feedback: feedbackStats,
      topUsersByQuestions: topUsersByQuestions.map(r => ({ ...r, question_count: Number(r.question_count) })),
      recentEvents: recentEvents.map(e => ({
        ...e,
        metadata: e.metadata ? JSON.parse(e.metadata) : null,
      })),
    };
  }

  // ─── UTILITY ─────────────────────────────────────────────────────────────────

  close() {
    this.client.close();
  }
}

// Export as singleton
module.exports = new DatabaseService();
