import crypto from "crypto";
import { getLogger } from "../logger.js";

const logger = getLogger();

/**
 * Audit action types for sensitive operations
 */
export const AuditActions = {
  USER_LOGIN: "USER_LOGIN",
  USER_LOGOUT: "USER_LOGOUT",
  USER_REGISTER: "USER_REGISTER",
  USER_DELETE: "USER_DELETE",
  ROLE_CHANGE: "ROLE_CHANGE",
  TOKEN_REFRESH: "TOKEN_REFRESH",
  TOKEN_REVOKE: "TOKEN_REVOKE",
  PASSWORD_CHANGE: "PASSWORD_CHANGE",
  EMAIL_CHANGE: "EMAIL_CHANGE",
  DATA_ACCESS: "DATA_ACCESS",
  DATA_EXPORT: "DATA_EXPORT",
  DATA_DELETE: "DATA_DELETE",
  PAYMENT_CREATE: "PAYMENT_CREATE",
  PAYMENT_REFUND: "PAYMENT_REFUND",
  SETTINGS_CHANGE: "SETTINGS_CHANGE",
  ADMIN_ACTION: "ADMIN_ACTION",
  GUILD_UPDATE: "GUILD_UPDATE",
  GUILD_DELETE: "GUILD_DELETE",
};

/**
 * Audit levels for categorizing events
 */
export const AuditLevels = {
  INFO: "info",
  WARNING: "warning",
  CRITICAL: "critical",
};

/**
 * Create a hash of data for secure audit storage
 * @param {any} data - Data to hash
 * @returns {string} SHA256 hash
 */
function hashData(data) {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

/**
 * Create an audit log entry
 * @param {string} action - The action being performed
 * @param {Object} details - Details about the action
 * @param {Object} context - Context (user, IP, etc.)
 * @param {string} level - Audit level
 * @returns {Object} Audit log entry
 */
export function createAuditEntry(
  action,
  details = {},
  context = {},
  level = AuditLevels.INFO,
) {
  const entry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    level,
    details: sanitizeDetails(details),
    context: sanitizeContext(context),
    hash: null, // Will be set after entry is complete
  };

  entry.hash = hashData({
    timestamp: entry.timestamp,
    action: entry.action,
    details: entry.details,
  });

  return entry;
}

/**
 * Sanitize details to remove sensitive fields
 * @param {Object} details - Details to sanitize
 * @returns {Object} Sanitized details
 */
function sanitizeDetails(details) {
  const sensitiveFields = [
    "password",
    "token",
    "accessToken",
    "refreshToken",
    "secret",
    "apiKey",
    "creditCard",
    "ssn",
    "phone",
  ];

  const sanitized = { ...details };

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = "[REDACTED]";
    }
  }

  return sanitized;
}

/**
 * Sanitize context to remove PII if needed
 * @param {Object} context - Context to sanitize
 * @returns {Object} Sanitized context
 */
function sanitizeContext(context) {
  return {
    userId: context.userId || null,
    userRole: context.userRole || null,
    ip: maskIP(context.ip),
    userAgent: context.userAgent || null,
    guildId: context.guildId || null,
    requestId: context.requestId || null,
  };
}

/**
 * Mask IP address for privacy
 * @param {string} ip - IP address
 * @returns {string} Masked IP
 */
function maskIP(ip) {
  if (!ip) return null;

  // Handle IPv4
  if (ip.includes(".")) {
    const parts = ip.split(".");
    return `${parts[0]}.${parts[1]}.***.${parts[3] || "***"}`;
  }

  // Handle IPv6
  if (ip.includes(":")) {
    return `${ip.substring(0, 4)}:****:****:****`;
  }

  return "***.***.***";
}

/**
 * Log an audit event
 * @param {string} action - Audit action
 * @param {Object} details - Action details
 * @param {Object} context - Request context
 * @param {string} level - Audit level
 */
export function auditLog(
  action,
  details = {},
  context = {},
  level = AuditLevels.INFO,
) {
  const entry = createAuditEntry(action, details, context, level);

  switch (level) {
    case AuditLevels.CRITICAL:
      logger.error(`AUDIT: ${action}`, entry);
      break;
    case AuditLevels.WARNING:
      logger.warn(`AUDIT: ${action}`, entry);
      break;
    default:
      logger.info(`AUDIT: ${action}`, entry);
  }

  return entry;
}

/**
 * Quick audit for user authentication events
 * @param {string} action - USER_LOGIN, USER_LOGOUT, etc.
 * @param {string} discordId - Discord user ID
 * @param {Object} extra - Extra details
 */
export function auditUserAction(action, discordId, extra = {}) {
  return auditLog(
    action,
    {
      discordId,
      ...extra,
    },
    {
      userId: discordId,
    },
  );
}

/**
 * Quick audit for admin actions
 * @param {string} adminId - Admin user ID
 * @param {string} action - Admin action performed
 * @param {Object} target - Target of the action
 * @param {Object} changes - Changes made
 */
export function auditAdminAction(adminId, action, target = {}, changes = {}) {
  return auditLog(
    AuditActions.ADMIN_ACTION,
    {
      adminAction: action,
      target,
      changes,
    },
    {
      userId: adminId,
      userRole: "admin",
    },
    AuditLevels.WARNING,
  );
}

/**
 * Quick audit for payment events
 * @param {string} userId - User ID
 * @param {string} action - PAYMENT_CREATE, PAYMENT_REFUND
 * @param {Object} paymentDetails - Payment details
 */
export function auditPayment(userId, action, paymentDetails = {}) {
  return auditLog(
    action,
    {
      // Don't log full payment details, just amounts and status
      paymentId: paymentDetails.paymentId,
      amount: paymentDetails.amount,
      currency: paymentDetails.currency,
      status: paymentDetails.status,
    },
    {
      userId,
    },
    AuditLevels.CRITICAL,
  );
}

export default {
  AuditActions,
  AuditLevels,
  auditLog,
  auditUserAction,
  auditAdminAction,
  auditPayment,
  createAuditEntry,
};
