import { getLogger } from "../logger.js";

const logger = getLogger();

const SESSION_TIMEOUT_MS =
  parseInt(process.env.SESSION_TIMEOUT_MS) || 30 * 60 * 1000;
const SESSION_CHECK_INTERVAL_MS =
  parseInt(process.env.SESSION_CHECK_INTERVAL_MS) || 5 * 60 * 1000;

const activeSessions = new Map();

export class SessionSecurityManager {
  constructor() {
    this.cleanupInterval = null;
    this.roleChangeListeners = new Map();
  }

  async initialize() {
    this.startCleanupInterval();
    logger.info(
      `SessionSecurityManager initialized with ${SESSION_TIMEOUT_MS / 1000 / 60} minute timeout`,
    );
  }

  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    activeSessions.clear();
    this.roleChangeListeners.clear();
  }

  startCleanupInterval() {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, SESSION_CHECK_INTERVAL_MS);
  }

  async cleanupExpiredSessions() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, sessionData] of activeSessions.entries()) {
      if (now - sessionData.lastActivity > SESSION_TIMEOUT_MS) {
        activeSessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  registerSession(sessionId, userId, discordId) {
    activeSessions.set(sessionId, {
      userId,
      discordId,
      sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      lastKnownRole: null,
      roleVersion: 0,
    });
    logger.debug(
      `Session registered: ${sessionId.slice(0, 8)}... for user ${discordId}`,
    );
  }

  updateSessionActivity(sessionId) {
    const session = activeSessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      return true;
    }
    return false;
  }

  updateSessionRole(sessionId, newRole, roleVersion) {
    const session = activeSessions.get(sessionId);
    if (session) {
      const oldRole = session.lastKnownRole;
      session.lastKnownRole = newRole;
      session.roleVersion = roleVersion;

      if (oldRole !== null && oldRole !== newRole) {
        logger.info(
          `Role change detected for session ${sessionId.slice(0, 8)}...: ${oldRole} -> ${newRole}`,
        );
        return { roleChanged: true, oldRole, newRole };
      }
      return { roleChanged: false };
    }
    return { roleChanged: false, sessionNotFound: true };
  }

  async checkSessionValidity(sessionId) {
    const session = activeSessions.get(sessionId);
    if (!session) {
      return { valid: false, reason: "SESSION_NOT_FOUND" };
    }

    const now = Date.now();
    if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
      activeSessions.delete(sessionId);
      return { valid: false, reason: "SESSION_EXPIRED" };
    }

    return { valid: true, session };
  }

  async checkRoleChange(sessionId, currentRole, currentRoleVersion) {
    const session = activeSessions.get(sessionId);
    if (!session) {
      return { valid: false, reason: "SESSION_NOT_FOUND" };
    }

    if (session.roleVersion !== currentRoleVersion) {
      return {
        valid: false,
        reason: "ROLE_CHANGED",
        oldRole: session.lastKnownRole,
        newRole: currentRole,
      };
    }

    return { valid: true };
  }

  async handleRoleChange(discordId, newRole, newRoleVersion) {
    const affectedSessions = [];

    for (const [sessionId, sessionData] of activeSessions.entries()) {
      if (sessionData.discordId === discordId) {
        const oldRole = sessionData.lastKnownRole;
        sessionData.lastKnownRole = newRole;
        sessionData.roleVersion = newRoleVersion;

        affectedSessions.push({
          sessionId,
          oldRole,
          newRole,
        });

        logger.info(
          `Force logout session ${sessionId.slice(0, 8)}... due to role change: ${oldRole} -> ${newRole}`,
        );
      }
    }

    return affectedSessions;
  }

  invalidateSession(sessionId) {
    const session = activeSessions.get(sessionId);
    if (session) {
      activeSessions.delete(sessionId);
      logger.debug(`Session invalidated: ${sessionId.slice(0, 8)}...`);
      return true;
    }
    return false;
  }

  invalidateAllUserSessions(discordId) {
    let count = 0;
    for (const [sessionId, sessionData] of activeSessions.entries()) {
      if (sessionData.discordId === discordId) {
        activeSessions.delete(sessionId);
        count++;
      }
    }
    logger.info(`Invalidated ${count} sessions for user ${discordId}`);
    return count;
  }

  getActiveSessionCount() {
    return activeSessions.size;
  }

  getSessionInfo(sessionId) {
    const session = activeSessions.get(sessionId);
    if (!session) return null;

    return {
      ...session,
      timeSinceActivity: Date.now() - session.lastActivity,
      isExpired: Date.now() - session.lastActivity > SESSION_TIMEOUT_MS,
    };
  }
}

let sessionSecurityManager = null;

export function getSessionSecurityManager() {
  if (!sessionSecurityManager) {
    sessionSecurityManager = new SessionSecurityManager();
  }
  return sessionSecurityManager;
}

export function validatePassword(password) {
  const MIN_LENGTH = 8;
  const hasMinLength = password.length >= MIN_LENGTH;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  const errors = [];
  if (!hasMinLength)
    errors.push(`Password must be at least ${MIN_LENGTH} characters`);
  if (!hasLetter) errors.push("Password must contain at least one letter");
  if (!hasNumber) errors.push("Password must contain at least one number");

  return {
    valid: hasMinLength && hasLetter && hasNumber,
    errors,
    strength: calculatePasswordStrength(password),
  };
}

function calculatePasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

  if (score <= 2) return "weak";
  if (score <= 4) return "medium";
  return "strong";
}

export class LoginAttemptTracker {
  constructor() {
    this.attempts = new Map();
    this.LOCKOUT_THRESHOLD = 5;
    this.LOCKOUT_DURATION_MS = 15 * 60 * 1000;
    this.ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
  }

  recordAttempt(identifier) {
    const now = Date.now();
    const userAttempts = this.attempts.get(identifier) || [];

    const recentAttempts = userAttempts.filter(
      time => now - time < this.ATTEMPT_WINDOW_MS,
    );
    recentAttempts.push(now);

    this.attempts.set(identifier, recentAttempts);

    const isLockedOut = this.isLockedOut(identifier);
    const remainingAttempts = Math.max(
      0,
      this.LOCKOUT_THRESHOLD - recentAttempts.length,
    );

    return {
      attempts: recentAttempts.length,
      remainingAttempts,
      isLockedOut,
      lockedUntil: isLockedOut ? this.getLockoutEndTime(identifier) : null,
    };
  }

  clearAttempts(identifier) {
    this.attempts.delete(identifier);
  }

  isLockedOut(identifier) {
    const userAttempts = this.attempts.get(identifier) || [];
    const now = Date.now();

    const recentAttempts = userAttempts.filter(
      time => now - time < this.ATTEMPT_WINDOW_MS,
    );

    if (recentAttempts.length >= this.LOCKOUT_THRESHOLD) {
      const lastAttempt = recentAttempts[recentAttempts.length - 1];
      const lockoutEnd = lastAttempt + this.LOCKOUT_DURATION_MS;
      return now < lockoutEnd;
    }

    return false;
  }

  getLockoutEndTime(identifier) {
    const userAttempts = this.attempts.get(identifier) || [];
    if (userAttempts.length === 0) return null;

    const lastAttempt = userAttempts[userAttempts.length - 1];
    return lastAttempt + this.LOCKOUT_DURATION_MS;
  }

  getRemainingLockoutTime(identifier) {
    const lockoutEnd = this.getLockoutEndTime(identifier);
    if (!lockoutEnd) return 0;
    return Math.max(0, lockoutEnd - Date.now());
  }

  cleanup() {
    const now = Date.now();
    for (const [identifier, attempts] of this.attempts.entries()) {
      const recentAttempts = attempts.filter(
        time => now - time < this.ATTEMPT_WINDOW_MS,
      );
      if (recentAttempts.length === 0) {
        this.attempts.delete(identifier);
      } else {
        this.attempts.set(identifier, recentAttempts);
      }
    }
  }
}

export class PasswordResetManager {
  constructor() {
    this.resetTokens = new Map();
    this.EMAIL_VERIFICATION_EXPIRY_MS = 15 * 60 * 1000;
    this.VERIFICATION_CODE_LENGTH = 6;
  }

  generateResetToken(email) {
    const code = this.generateVerificationCode();
    const token = this.generateSecureToken();

    this.resetTokens.set(token, {
      email: email.toLowerCase(),
      code,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.EMAIL_VERIFICATION_EXPIRY_MS,
      attempts: 0,
      verified: false,
    });

    return {
      token,
      code,
      expiresIn: this.EMAIL_VERIFICATION_EXPIRY_MS / 1000,
    };
  }

  generateVerificationCode() {
    let code = "";
    for (let i = 0; i < this.VERIFICATION_CODE_LENGTH; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    return code;
  }

  generateSecureToken() {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    const randomArray = new Uint8Array(32);
    globalThis.crypto.getRandomValues(randomArray);
    for (let i = 0; i < 32; i++) {
      token += chars[randomArray[i] % chars.length];
    }
    return token;
  }

  verifyCode(token, code) {
    const resetData = this.resetTokens.get(token);
    if (!resetData) {
      return { valid: false, error: "Invalid or expired reset token" };
    }

    if (Date.now() > resetData.expiresAt) {
      this.resetTokens.delete(token);
      return { valid: false, error: "Reset token has expired" };
    }

    if (resetData.verified) {
      return { valid: false, error: "Code already verified" };
    }

    if (resetData.code !== code) {
      resetData.attempts++;
      if (resetData.attempts >= 3) {
        this.resetTokens.delete(token);
        return { valid: false, error: "Too many incorrect attempts" };
      }
      return { valid: false, error: "Invalid verification code" };
    }

    resetData.verified = true;
    resetData.expiresAt = Date.now() + this.EMAIL_VERIFICATION_EXPIRY_MS;

    return { valid: true, verified: true };
  }

  validateNewPassword(token, newPassword) {
    const resetData = this.resetTokens.get(token);
    if (!resetData) {
      return { valid: false, error: "Invalid or expired reset token" };
    }

    if (!resetData.verified) {
      return { valid: false, error: "Email not verified" };
    }

    if (Date.now() > resetData.expiresAt) {
      this.resetTokens.delete(token);
      return { valid: false, error: "Reset token has expired" };
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return { valid: false, error: passwordValidation.errors.join(", ") };
    }

    this.resetTokens.delete(token);
    return { valid: true };
  }

  cleanup() {
    const now = Date.now();
    for (const [token, data] of this.resetTokens.entries()) {
      if (now > data.expiresAt) {
        this.resetTokens.delete(token);
      }
    }
  }

  revokeToken(token) {
    return this.resetTokens.delete(token);
  }
}

export default {
  SessionSecurityManager,
  getSessionSecurityManager,
};
