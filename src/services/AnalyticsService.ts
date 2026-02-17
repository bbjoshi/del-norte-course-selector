import axios from 'axios';

/**
 * Client-side analytics service for tracking user behavior and usage metrics.
 * Sends events to the server-side SQLite database for aggregation.
 */
class AnalyticsServiceClass {
  private static instance: AnalyticsServiceClass;
  private appSessionId: string | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private userId: string | null = null;
  private userEmail: string | null = null;

  private constructor() {}

  static getInstance(): AnalyticsServiceClass {
    if (!AnalyticsServiceClass.instance) {
      AnalyticsServiceClass.instance = new AnalyticsServiceClass();
    }
    return AnalyticsServiceClass.instance;
  }

  /**
   * Track a generic analytics event
   */
  async trackEvent(eventType: string, metadata?: Record<string, any>): Promise<void> {
    try {
      await axios.post('/api/analytics/track', {
        eventType,
        userId: this.userId,
        userEmail: this.userEmail,
        sessionId: this.appSessionId,
        metadata,
      });
    } catch (error) {
      console.error('Failed to track analytics event:', error);
    }
  }

  /**
   * Set the current user for analytics tracking
   */
  setUser(userId: string, email: string | null): void {
    this.userId = userId;
    this.userEmail = email;
  }

  /**
   * Clear user info (on logout)
   */
  clearUser(): void {
    this.userId = null;
    this.userEmail = null;
  }

  /**
   * Track account creation
   */
  async trackAccountCreated(userId: string, email: string): Promise<void> {
    this.setUser(userId, email);
    await this.trackEvent('account_created', { email });
  }

  /**
   * Track user login
   */
  async trackLogin(userId: string, email: string, method: string = 'email'): Promise<void> {
    this.setUser(userId, email);
    await this.trackEvent('login', { email, method });
  }

  /**
   * Track user logout
   */
  async trackLogout(): Promise<void> {
    await this.trackEvent('logout');
    this.endSession();
    this.clearUser();
  }

  /**
   * Track a question being asked
   */
  async trackQuestionAsked(questionText: string, chatSessionId?: string): Promise<void> {
    await this.trackEvent('question_asked', {
      questionLength: questionText.length,
      chatSessionId,
      questionPreview: questionText.substring(0, 100),
    });

    // Also increment session question count
    if (this.appSessionId) {
      try {
        await axios.post('/api/analytics/session/heartbeat', {
          sessionId: this.appSessionId,
        });
      } catch (error) {
        // Silently fail
      }
    }
  }

  /**
   * Track an answer being received
   */
  async trackAnswerReceived(answerLength: number, chatSessionId?: string): Promise<void> {
    await this.trackEvent('answer_received', {
      answerLength,
      chatSessionId,
    });
  }

  /**
   * Track a new chat session being started
   */
  async trackChatSessionStarted(chatSessionId: string): Promise<void> {
    await this.trackEvent('chat_session_started', { chatSessionId });
  }

  /**
   * Track feedback submitted
   */
  async trackFeedbackSubmitted(rating: string, hasComment: boolean): Promise<void> {
    await this.trackEvent('feedback_submitted', { rating, hasComment });
  }

  /**
   * Start an app-level user session (tracks time on site)
   */
  async startSession(): Promise<void> {
    if (this.appSessionId) return; // Already started

    this.appSessionId = `app_session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      await axios.post('/api/analytics/session/start', {
        sessionId: this.appSessionId,
        userId: this.userId,
        userEmail: this.userEmail,
      });
    } catch (error) {
      console.error('Failed to start analytics session:', error);
    }

    // Send heartbeat every 30 seconds to track session duration
    this.heartbeatInterval = setInterval(async () => {
      if (this.appSessionId) {
        try {
          await axios.post('/api/analytics/session/heartbeat', {
            sessionId: this.appSessionId,
          });
        } catch (error) {
          // Silently fail
        }
      }
    }, 30000);

    // End session on page unload
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  /**
   * End current app-level session
   */
  endSession(): void {
    if (!this.appSessionId) return;

    // Send end session via sendBeacon for reliability
    const data = JSON.stringify({ sessionId: this.appSessionId });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/session/end', new Blob([data], { type: 'application/json' }));
    } else {
      // Fallback to fetch with keepalive
      fetch('/api/analytics/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
        keepalive: true,
      }).catch(() => {});
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    this.appSessionId = null;
  }

  private handleBeforeUnload = (): void => {
    this.endSession();
  };

  /**
   * Track page/view navigation
   */
  async trackPageView(pageName: string): Promise<void> {
    await this.trackEvent('page_view', { pageName });
  }
}

export const AnalyticsService = AnalyticsServiceClass.getInstance();
