/**
 * Centralized user-facing error message formatting for AI features
 * Provides consistent error messages across all AI commands
 */

/**
 * Convert technical error messages to user-friendly messages
 * @param {Error|Object} error - Error object or error-like object
 * @param {Object} options - Additional options
 * @param {boolean} options.includeContentModeration - Include content moderation specific messages (default: true)
 * @returns {string} User-friendly error message
 */
export function getUserFacingErrorMessage(error, options = {}) {
  const { includeContentModeration = true } = options;

  if (!error || !error.message) {
    return "Something went wrong. Please try again shortly.";
  }

  const message = error.message;

  // AI features disabled
  if (/ai features are disabled/i.test(message)) {
    return "AI features are currently disabled. All providers are disabled in the configuration. Please contact the bot administrator.";
  }

  // Rate limiting
  if (/rate limit/i.test(message)) {
    return "You're sending prompts too quickly. Please wait a moment before trying again.";
  }

  // API configuration issues
  if (/api key not configured/i.test(message)) {
    return "The AI provider is not properly configured. Please contact the bot administrator.";
  }

  // Queue full
  if (/queue is full/i.test(message)) {
    return "Generation queue is full right now. Please try again in a moment.";
  }

  // Timeout
  if (/timed out/i.test(message)) {
    return "The AI provider took too long to respond. Try a shorter prompt or retry later.";
  }

  // Content moderation (only for image generation)
  if (includeContentModeration && /content moderation/i.test(message)) {
    return "The AI provider blocked image generation due to content moderation. The prompt was detected as inappropriate. Try using a less explicit prompt.";
  }

  // Return original message if no pattern matches
  return message;
}
