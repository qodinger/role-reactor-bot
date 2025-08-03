import crypto from "crypto";
import { getLogger } from "../logger.js";

/**
 * Session Manager for handling temporary session data
 * Implements cookie policy compliance as specified in Privacy Policy
 */
class SessionManager {
  constructor() {
    this.logger = getLogger();
    this.sessions = new Map();
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    this.cleanupInterval = 5 * 60 * 1000; // 5 minutes

    // Start cleanup process
    this.startCleanup();
  }

  /**
   * Create a new session for a user
   * @param {string} userId - Discord user ID
   * @param {string} guildId - Discord guild ID
   * @returns {string} Session ID
   */
  createSession(userId, guildId = null) {
    const sessionId = crypto.randomUUID();
    const session = {
      userId,
      guildId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      data: {},
    };

    this.sessions.set(sessionId, session);

    this.logger.debug("Session created", {
      sessionId,
      userId,
      guildId,
      totalSessions: this.sessions.size,
    });

    return sessionId;
  }

  /**
   * Get session data
   * @param {string} sessionId - Session identifier
   * @returns {Object|null} Session data or null if not found/expired
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check if session has expired
    if (Date.now() - session.lastActivity > this.sessionTimeout) {
      this.sessions.delete(sessionId);
      this.logger.debug("Session expired", { sessionId });
      return null;
    }

    // Update last activity
    session.lastActivity = Date.now();
    return session;
  }

  /**
   * Update session data
   * @param {string} sessionId - Session identifier
   * @param {Object} data - Data to store in session
   */
  updateSession(sessionId, data) {
    const session = this.getSession(sessionId);
    if (session) {
      session.data = { ...session.data, ...data };
      session.lastActivity = Date.now();

      this.logger.debug("Session updated", {
        sessionId,
        userId: session.userId,
        dataKeys: Object.keys(data),
      });
    }
  }

  /**
   * Delete a session
   * @param {string} sessionId - Session identifier
   */
  deleteSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.logger.debug("Session deleted", {
        sessionId,
        userId: session.userId,
      });
    }
  }

  /**
   * Get all sessions for a user
   * @param {string} userId - Discord user ID
   * @returns {Array} Array of session IDs
   */
  getUserSessions(userId) {
    const userSessions = [];
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        userSessions.push(sessionId);
      }
    }
    return userSessions;
  }

  /**
   * Clean up expired sessions
   */
  cleanup() {
    const now = Date.now();
    let expiredCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.sessionTimeout) {
        this.sessions.delete(sessionId);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.logger.info("Session cleanup completed", {
        expiredSessions: expiredCount,
        remainingSessions: this.sessions.size,
      });
    }
  }

  /**
   * Start automatic cleanup process
   */
  startCleanup() {
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval).unref();
  }

  /**
   * Get session statistics
   * @returns {Object} Session statistics
   */
  getStats() {
    const now = Date.now();
    let activeSessions = 0;
    let expiredSessions = 0;

    for (const session of this.sessions.values()) {
      if (now - session.lastActivity <= this.sessionTimeout) {
        activeSessions++;
      } else {
        expiredSessions++;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      expiredSessions,
      sessionTimeout: this.sessionTimeout,
    };
  }

  /**
   * Clear all sessions (for testing or emergency)
   */
  clearAll() {
    const count = this.sessions.size;
    this.sessions.clear();
    this.logger.warn("All sessions cleared", { clearedCount: count });
  }
}

let sessionManager = null;

/**
 * Get the session manager instance
 * @returns {SessionManager} Session manager instance
 */
export function getSessionManager() {
  if (!sessionManager) {
    sessionManager = new SessionManager();
  }
  return sessionManager;
}

/**
 * Create a session for bot functionality
 * @param {string} userId - Discord user ID
 * @param {string} guildId - Discord guild ID
 * @returns {string} Session ID
 */
export function createBotSession(userId, guildId = null) {
  const manager = getSessionManager();
  return manager.createSession(userId, guildId);
}

/**
 * Get session data for bot functionality
 * @param {string} sessionId - Session identifier
 * @returns {Object|null} Session data
 */
export function getBotSession(sessionId) {
  const manager = getSessionManager();
  return manager.getSession(sessionId);
}

/**
 * Update session data for bot functionality
 * @param {string} sessionId - Session identifier
 * @param {Object} data - Data to store
 */
export function updateBotSession(sessionId, data) {
  const manager = getSessionManager();
  return manager.updateSession(sessionId, data);
}
