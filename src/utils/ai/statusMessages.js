/**
 * Centralized AI status messages
 * Easy to update and maintain all status messages in one place
 */

export const AI_STATUS_MESSAGES = {
  // ============================================================================
  // AI CHAT STATUS MESSAGES
  // ============================================================================

  // Initial preparation
  PREPARING: "Preparing my response...",

  // Server data checking
  CHECKING_SERVER: "Checking server details...",

  // Conversation review
  REVIEWING_CONVERSATION: "Reviewing our conversation...",

  // Response generation
  CRAFTING_RESPONSE: "Crafting my response...",

  // Action processing
  PROCESSING_REQUEST: "🤔 Processing your request...",

  // Message thinking (for messageCreate event)
  THINKING_ABOUT_MESSAGE: "Thinking about your message...",

  // Queue status (formatted dynamically)
  QUEUE_POSITION: (position, totalInSystem, waitTime) => {
    if (position === null) {
      // Processing or not in queue
      return null;
    }
    if (position === 0) {
      return "Starting processing...";
    }

    // Format wait time nicely
    let waitText;
    if (waitTime < 60) {
      waitText = `${Math.ceil(waitTime)} sec`;
    } else {
      const minutes = Math.ceil(waitTime / 60);
      waitText = minutes === 1 ? "~1 min" : `~${minutes} min`;
    }

    // Show position in queue (1-based for user-friendly display)
    return `Waiting in queue (position ${position + 1}, ${waitText} estimated wait)`;
  },

  // ============================================================================
  // IMAGE GENERATION STATUS MESSAGES
  // ============================================================================

  // Avatar generation steps
  AVATAR_INITIALIZING: "Initializing AI service...",
  AVATAR_BUILDING_PROMPT: "Building enhanced prompt...",
  AVATAR_CONNECTING: "Connecting to AI provider...",
  AVATAR_GENERATING: "Generating image (this may take 30-60s)...",
  AVATAR_PROCESSING: "Processing image data...",
  AVATAR_FINALIZING: "Finalizing result...",

  // Stability AI provider steps
  STABILITY_PREPARING: "Preparing request for Stability AI...",
  STABILITY_GENERATING: "Generating image (this may take 30-60s)...",
  STABILITY_PROCESSING: "Processing generated image...",

  // OpenRouter provider steps
  OPENROUTER_SENDING: "Sending generation request...",
  OPENROUTER_PROCESSING: "Processing image response...",
  OPENROUTER_DOWNLOADING: "Downloading generated image...",

  // OpenAI provider steps
  OPENAI_SENDING: "Sending generation request...",
  OPENAI_DOWNLOADING: "Downloading generated image...",

  // Self-hosted provider steps
  SELFHOSTED_SENDING: "Sending generation request...",
  SELFHOSTED_GENERATING: "Generating image (this may take 30-60s)...",
  SELFHOSTED_PROCESSING: "Processing generated image...",

  // Multi-provider service steps
  MULTIPROVIDER_INITIALIZING: "Initializing image generation...",
};

/**
 * Get a status message by key
 * @param {string} key - Status message key
 * @returns {string} Status message
 */
export function getStatusMessage(key) {
  const message = AI_STATUS_MESSAGES[key];
  if (typeof message === "function") {
    throw new Error(
      `Status message "${key}" is a function and requires parameters. Use it directly.`,
    );
  }
  return message || key;
}
