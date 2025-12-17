import { getLogger } from "../logger.js";

const logger = getLogger();

/**
 * Validates and sanitizes AI responses to ensure data accuracy and security
 */
export class ResponseValidator {
  /**
   * Validate that AI response uses real data from server
   * @param {string} response - AI response text
   * @param {import('discord.js').Guild} guild - Discord guild
   * @returns {Object} Validation result with warnings and suggestions
   */
  validateResponseData(response, guild) {
    if (!guild || !response) {
      return { valid: true, warnings: [], suggestions: [] };
    }

    const warnings = [];
    const suggestions = [];

    // Get actual server data for validation
    const actualMemberNames = Array.from(guild.members.cache.values())
      .filter(m => m && m.user && !m.user.bot)
      .map(m => (m.displayName || m.user.username).toLowerCase());
    const actualRoleNames = Array.from(guild.roles.cache.values())
      .map(r => r.name.toLowerCase())
      .filter(name => name !== "@everyone");
    const actualChannelNames = Array.from(guild.channels.cache.values())
      .map(c => c.name?.toLowerCase())
      .filter(Boolean);

    // Common fake/generic names that AI might use
    const fakeNames = [
      "john",
      "jane",
      "alice",
      "bob",
      "charlie",
      "david",
      "emma",
      "frank",
      "george",
      "helen",
      "ifunny",
      "reddit",
      "discord",
      "user",
      "member",
      "admin",
      "moderator",
      "test",
      "example",
    ];

    // Check for placeholder patterns
    const placeholderPatterns = [
      /\[ACTUAL_(MEMBER|USERNAME|ROLE|CHANNEL|USER_ID|ROLE_ID|CHANNEL_ID)/i,
      /\[ROLE_NAME\]/i,
      /\[ACTUAL_/i,
      /\[PLACEHOLDER/i,
      /\[EXAMPLE/i,
    ];

    placeholderPatterns.forEach(pattern => {
      if (pattern.test(response)) {
        warnings.push(
          `Response contains placeholder patterns - AI may not have used real data`,
        );
      }
    });

    // Extract potential member names from response (simple heuristic)
    const memberMentions = response.match(/@?([A-Za-z0-9_]+)/g) || [];
    memberMentions.forEach(mention => {
      const name = mention.replace("@", "").toLowerCase();
      if (
        fakeNames.includes(name) &&
        !actualMemberNames.includes(name) &&
        name.length > 2
      ) {
        warnings.push(
          `Response may contain fake member name: "${mention}" - verify against actual member list`,
        );
        if (actualMemberNames.length > 0) {
          suggestions.push(
            `Use actual member names from the server instead of "${mention}"`,
          );
        }
      }
    });

    // Check for generic role mentions that might not exist
    const roleMentions = response.match(/\b(Admin|Moderator|Member|User)\b/gi);
    if (roleMentions) {
      roleMentions.forEach(role => {
        const roleLower = role.toLowerCase();
        if (!actualRoleNames.includes(roleLower)) {
          warnings.push(
            `Response mentions role "${role}" which may not exist in this server`,
          );
        }
      });
    }

    // Check for generic channel mentions
    const channelMentions = response.match(
      /#(general|welcome|announcements)/gi,
    );
    if (channelMentions) {
      channelMentions.forEach(channel => {
        const channelLower = channel.replace("#", "").toLowerCase();
        if (!actualChannelNames.includes(channelLower)) {
          warnings.push(
            `Response mentions channel "${channel}" which may not exist in this server`,
          );
        }
      });
    }

    return {
      valid: warnings.length === 0,
      warnings,
      suggestions,
      actualDataCounts: {
        members: actualMemberNames.length,
        roles: actualRoleNames.length,
        channels: actualChannelNames.length,
      },
    };
  }

  /**
   * Sanitize data to prevent exposing sensitive information
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  sanitizeData(text) {
    if (!text || typeof text !== "string") return text;

    let sanitized = text;

    // Remove specific API key patterns (more precise to avoid false positives)
    const sensitivePatterns = [
      // OpenAI API keys
      /sk-[a-zA-Z0-9]{32,}/gi,
      // Stability AI keys (starts with specific prefix)
      /sk-[a-zA-Z0-9]{40,}/gi,
      // Generic bearer tokens
      /Bearer\s+[A-Za-z0-9]{32,}/gi,
      // GitHub tokens
      /ghp_[A-Za-z0-9]{36}/gi,
      // Slack tokens
      /xox[baprs]-[A-Za-z0-9-]+/gi,
      // AWS keys (but allow Discord IDs which are 17-19 digits)
      /AKIA[0-9A-Z]{16}/gi,
      // MongoDB connection strings (but be careful not to match Discord IDs)
      /mongodb\+srv:\/\/[^\s]+/gi,
      // Generic connection strings with credentials
      /[a-z]+:\/\/[^:]+:[^@]+@[^\s]+/gi,
    ];

    for (const pattern of sensitivePatterns) {
      sanitized = sanitized.replace(pattern, "[REDACTED]");
    }

    // Remove environment variable references (but allow normal text)
    sanitized = sanitized.replace(
      /\$\{[A-Z_]{3,}\}|process\.env\.[A-Z_]{3,}/g,
      "[CONFIG]",
    );

    // Remove potential base64 encoded secrets (but allow normal base64 images/data URLs)
    // Only match if it looks like a standalone token
    sanitized = sanitized.replace(
      /\b[A-Za-z0-9+/]{40,}={0,2}\b(?![^\s]*data:image)/g,
      match => {
        // Don't redact if it's part of a data URL or looks like Discord asset
        if (match.includes("data:") || match.includes("discord")) {
          return match;
        }
        // Don't redact Discord IDs (17-19 digits)
        if (/^\d{17,19}$/.test(match)) {
          return match;
        }
        return "[REDACTED]";
      },
    );

    return sanitized;
  }

  /**
   * Validate response length and format
   * @param {string} response - Response text
   * @param {number} maxLength - Maximum allowed length
   * @returns {Object} Validation result with cleaned response
   */
  validateResponseLength(response, maxLength = 2000) {
    if (!response || response.trim().length === 0) {
      return {
        valid: false,
        cleaned:
          "I couldn't generate a response. Please try rephrasing your question or use /help for available commands.",
      };
    }

    let cleaned = response.trim();

    // Remove common AI disclaimers that aren't helpful
    cleaned = cleaned.replace(
      /(Note: I don't have real-time access|I'm a language model|I don't have personal experiences)[^.]*\./gi,
      "",
    );

    // Check response length
    if (cleaned.length > maxLength) {
      logger.warn(
        `Response exceeds maximum length (${cleaned.length} > ${maxLength}), truncating`,
      );
      cleaned = `${cleaned.substring(0, maxLength - 3)}...`;
    }

    return {
      valid: true,
      cleaned,
    };
  }
}

export const responseValidator = new ResponseValidator();
