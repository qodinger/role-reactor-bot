/**
 * Prompt Version Metadata
 * Tracks version information for all prompt modules
 */

/**
 * Prompt version information
 * @type {Object}
 */
export const PROMPT_VERSIONS = {
  image: {
    version: "1.0.0",
    lastUpdated: "2025-12-30",
    description: "Image generation prompts and templates",
  },
  chat: {
    version: "1.1.0",
    lastUpdated: "2025-12-30",
    description: "Chat system prompts (reorganized into sub-categories)",
    subCategories: {
      system: "1.0.0",
      commands: "1.0.0",
      responses: "1.0.0",
    },
  },
};

/**
 * Get version information for a prompt type
 * @param {string} promptType - Type of prompt ('image' or 'chat')
 * @returns {Object|null} Version information or null if not found
 */
export function getPromptVersion(promptType) {
  return PROMPT_VERSIONS[promptType] || null;
}

/**
 * Get all prompt versions
 * @returns {Object} All prompt version information
 */
export function getAllPromptVersions() {
  return PROMPT_VERSIONS;
}
