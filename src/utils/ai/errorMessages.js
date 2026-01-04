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
  if (
    /ai features are disabled|ai features are currently disabled/i.test(message)
  ) {
    return "AI features are currently disabled. All AI services are unavailable.";
  }

  // Rate limiting
  if (/rate limit/i.test(message)) {
    return "You're sending prompts too quickly. Please wait a moment before trying again.";
  }

  // API configuration issues
  if (
    /api key not configured|authentication failed|invalid api key/i.test(
      message,
    )
  ) {
    return "The AI service is not properly configured. The bot's service provider needs to fix the API setup.";
  }

  // Credit/billing issues
  if (
    /run out of credits|lack sufficient credits|insufficient credits|credits.*expired|billing.*issue/i.test(
      message,
    )
  ) {
    return message; // Already user-friendly, return as-is
  }

  // Provider not configured or enabled (already user-friendly messages)
  if (
    /not properly configured|currently unavailable|temporarily unavailable/i.test(
      message,
    )
  ) {
    return message; // Already user-friendly, return as-is
  }

  // Queue full
  if (/queue is full/i.test(message)) {
    return "Generation queue is full right now. Please try again in a moment.";
  }

  // Image generation specific errors
  if (
    /no image generated|no image found|failed to retrieve|failed to download|image.*missing|image.*invalid|image.*empty/i.test(
      message,
    )
  ) {
    return "Image generation failed. The image could not be retrieved. Please try again.";
  }

  // Text generation errors
  if (
    /no text generated|response missing|did not generate a response/i.test(
      message,
    )
  ) {
    return "The AI service did not generate a response. Please try again.";
  }

  // Prompt validation errors
  if (/prompt too long|maximum.*characters/i.test(message)) {
    return "Your prompt is too long. Please shorten it and try again.";
  }

  // Internal errors
  if (
    /internal error|unexpected response|encountered an error|service.*error/i.test(
      message,
    )
  ) {
    return "The AI service encountered an error. Please try again later.";
  }

  // Service unavailable errors
  if (
    /not available|unavailable|failed.*generate|all.*providers.*failed|ai chat.*unavailable/i.test(
      message,
    )
  ) {
    // Check if it's the specific "all services unavailable" message
    if (/all.*services.*unavailable/i.test(message)) {
      return message; // Already user-friendly, return as-is
    }
    return "The AI service is currently unavailable. Please try again later.";
  }

  // Workflow/process errors
  if (
    /workflow.*error|workflow.*failed|process.*failed|generation.*failed/i.test(
      message,
    )
  ) {
    return "Image generation failed. Please try a different prompt or try again later.";
  }

  // Timeout errors (more specific patterns)
  if (/timed out|took too long|timeout/i.test(message)) {
    if (/image|generation/i.test(message)) {
      return "Image generation timed out. The process took too long to complete. Please try again with a simpler prompt.";
    }
    return "The AI service took too long to respond. Try a shorter prompt or retry later.";
  }

  // Content moderation (only for image generation)
  if (includeContentModeration && /content moderation/i.test(message)) {
    return "The AI provider blocked image generation due to content moderation. The prompt was detected as inappropriate. Try using a less explicit prompt.";
  }

  // Generic fallback for user-friendly messages that don't match patterns
  // If the message already looks user-friendly (no technical jargon), return as-is
  if (
    !/api|error|status|code|exception|stack|trace|debug|log|config|key|token|endpoint|url|http|https|json|buffer|workflow|prompt_id|run_id/i.test(
      message.toLowerCase(),
    )
  ) {
    return message;
  }

  // Return generic error for unmatched technical errors
  return "Something went wrong. Please try again later.";
}
