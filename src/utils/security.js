import { getLogger } from "./logger.js";

/**
 * Security utility for input validation and sanitization
 * Following Discord API best practices to prevent common vulnerabilities
 */
class Security {
  constructor() {
    this.logger = getLogger();
  }

  /**
   * Validate Discord user ID format
   * @param {string} userId - User ID to validate
   * @returns {boolean} True if valid
   */
  validateUserId(userId) {
    if (!userId || typeof userId !== "string") {
      return false;
    }

    // Discord user IDs are 17-19 digits
    const userIdRegex = /^\d{17,19}$/;
    return userIdRegex.test(userId);
  }

  /**
   * Validate Discord guild ID format
   * @param {string} guildId - Guild ID to validate
   * @returns {boolean} True if valid
   */
  validateGuildId(guildId) {
    if (!guildId || typeof guildId !== "string") {
      return false;
    }

    // Discord guild IDs are 17-19 digits
    const guildIdRegex = /^\d{17,19}$/;
    return guildIdRegex.test(guildId);
  }

  /**
   * Validate Discord channel ID format
   * @param {string} channelId - Channel ID to validate
   * @returns {boolean} True if valid
   */
  validateChannelId(channelId) {
    if (!channelId || typeof channelId !== "string") {
      return false;
    }

    // Discord channel IDs are 17-19 digits
    const channelIdRegex = /^\d{17,19}$/;
    return channelIdRegex.test(channelId);
  }

  /**
   * Validate Discord message ID format
   * @param {string} messageId - Message ID to validate
   * @returns {boolean} True if valid
   */
  validateMessageId(messageId) {
    if (!messageId || typeof messageId !== "string") {
      return false;
    }

    // Discord message IDs are 17-19 digits
    const messageIdRegex = /^\d{17,19}$/;
    return messageIdRegex.test(messageId);
  }

  /**
   * Validate Discord role ID format
   * @param {string} roleId - Role ID to validate
   * @returns {boolean} True if valid
   */
  validateRoleId(roleId) {
    if (!roleId || typeof roleId !== "string") {
      return false;
    }

    // Discord role IDs are 17-19 digits
    const roleIdRegex = /^\d{17,19}$/;
    return roleIdRegex.test(roleId);
  }

  /**
   * Validate emoji format (custom or Unicode)
   * @param {string} emoji - Emoji to validate
   * @returns {boolean} True if valid
   */
  validateEmoji(emoji) {
    if (!emoji || typeof emoji !== "string") {
      return false;
    }

    // Custom emoji format: <:name:id>
    const customEmojiRegex = /^<a?:[a-zA-Z0-9_]+:\d{17,19}>$/;

    // Unicode emoji (basic check)
    const unicodeEmojiRegex =
      /^[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]$/u;

    return customEmojiRegex.test(emoji) || unicodeEmojiRegex.test(emoji);
  }

  /**
   * Sanitize string input to prevent injection attacks
   * @param {string} input - Input to sanitize
   * @param {number} maxLength - Maximum length allowed
   * @returns {string} Sanitized string
   */
  sanitizeString(input, maxLength = 1000) {
    if (!input || typeof input !== "string") {
      return "";
    }

    // Remove null bytes and control characters
    // eslint-disable-next-line no-control-regex
    let sanitized = input.replace(/[\u0000-\u001F\u007F]/g, "");

    // Remove potential script tags and dangerous patterns
    sanitized = sanitized.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      "",
    );
    sanitized = sanitized.replace(/javascript:/gi, "");
    sanitized = sanitized.replace(/on\w+\s*=/gi, "");

    // Limit length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized.trim();
  }

  /**
   * Validate and sanitize command name
   * @param {string} commandName - Command name to validate
   * @returns {string|null} Sanitized command name or null if invalid
   */
  validateCommandName(commandName) {
    if (!commandName || typeof commandName !== "string") {
      return null;
    }

    // Command names should be lowercase, alphanumeric with hyphens and underscores
    const commandNameRegex = /^[a-z0-9_-]+$/;
    const sanitized = commandName.toLowerCase().trim();

    if (!commandNameRegex.test(sanitized)) {
      return null;
    }

    return sanitized;
  }

  /**
   * Validate role name for security
   * @param {string} roleName - Role name to validate
   * @returns {boolean} True if valid
   */
  validateRoleName(roleName) {
    if (!roleName || typeof roleName !== "string") {
      return false;
    }

    // Role names should be 1-100 characters, no dangerous patterns
    if (roleName.length < 1 || roleName.length > 100) {
      return false;
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /data:text\/html/gi,
      /vbscript:/gi,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(roleName)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate duration for temporary roles
   * @param {number} duration - Duration in minutes
   * @returns {boolean} True if valid
   */
  validateDuration(duration) {
    if (typeof duration !== "number" || isNaN(duration)) {
      return false;
    }

    // Duration should be between 1 minute and 30 days
    const minDuration = 1; // 1 minute
    const maxDuration = 30 * 24 * 60; // 30 days in minutes

    return duration >= minDuration && duration <= maxDuration;
  }

  /**
   * Validate color hex code
   * @param {string} color - Color hex code to validate
   * @returns {boolean} True if valid
   */
  validateColor(color) {
    if (!color || typeof color !== "string") {
      return false;
    }

    // Hex color format: #RRGGBB or #RGB
    const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return colorRegex.test(color);
  }

  /**
   * Validate URL for security
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid and safe
   */
  validateUrl(url) {
    if (!url || typeof url !== "string") {
      return false;
    }

    try {
      const parsedUrl = new URL(url);

      // Only allow HTTP and HTTPS protocols
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return false;
      }

      // Check for dangerous patterns
      const dangerousPatterns = [
        /javascript:/gi,
        /data:text\/html/gi,
        /vbscript:/gi,
        /file:/gi,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(url)) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Log security event
   * @param {string} event - Security event type
   * @param {Object} data - Event data
   */
  logSecurityEvent(event, data = {}) {
    this.logger.warn(`Security Event: ${event}`, {
      event,
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  /**
   * Check for potential security threats in input
   * @param {string} input - Input to check
   * @returns {Object} Security analysis result
   */
  analyzeSecurity(input) {
    if (!input || typeof input !== "string") {
      return { safe: true, threats: [] };
    }

    const threats = [];

    // Check for common attack patterns
    const threatPatterns = [
      {
        pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        type: "XSS",
      },
      { pattern: /javascript:/gi, type: "XSS" },
      { pattern: /on\w+\s*=/gi, type: "XSS" },
      { pattern: /data:text\/html/gi, type: "XSS" },
      { pattern: /vbscript:/gi, type: "XSS" },
      { pattern: /union\s+select/gi, type: "SQL Injection" },
      { pattern: /drop\s+table/gi, type: "SQL Injection" },
      { pattern: /delete\s+from/gi, type: "SQL Injection" },
      { pattern: /eval\s*\(/gi, type: "Code Injection" },
      { pattern: /setTimeout\s*\(/gi, type: "Code Injection" },
      { pattern: /setInterval\s*\(/gi, type: "Code Injection" },
    ];

    for (const { pattern, type } of threatPatterns) {
      if (pattern.test(input)) {
        threats.push(type);
      }
    }

    return {
      safe: threats.length === 0,
      threats,
      input: this.sanitizeString(input),
    };
  }

  /**
   * Generate secure random string
   * @param {number} length - Length of string to generate
   * @returns {string} Secure random string
   */
  generateSecureString(length = 32) {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";

    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return result;
  }

  /**
   * Validate file extension for security
   * @param {string} filename - Filename to validate
   * @returns {boolean} True if safe
   */
  validateFileExtension(filename) {
    if (!filename || typeof filename !== "string") {
      return false;
    }

    // Dangerous file extensions
    const dangerousExtensions = [
      ".exe",
      ".bat",
      ".cmd",
      ".com",
      ".pif",
      ".scr",
      ".vbs",
      ".js",
      ".jar",
      ".msi",
      ".dll",
      ".sys",
      ".drv",
      ".bin",
      ".sh",
      ".py",
      ".php",
      ".asp",
      ".aspx",
      ".jsp",
      ".pl",
      ".cgi",
      ".rb",
      ".ps1",
      ".psm1",
      ".psd1",
    ];

    const extension = filename
      .toLowerCase()
      .substring(filename.lastIndexOf("."));
    return !dangerousExtensions.includes(extension);
  }
}

// Export singleton instance
export const security = new Security();
export default security;
