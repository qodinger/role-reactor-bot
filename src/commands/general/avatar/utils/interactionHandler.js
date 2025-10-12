import { getLogger } from "../../../../utils/logger.js";

const logger = getLogger();

/**
 * Interaction handling utilities
 */
export class InteractionHandler {
  /**
   * Safely defer an interaction with error handling
   * @param {Object} interaction - Discord interaction
   * @param {Object} options - Defer options including flags
   * @returns {Promise<boolean>} Success status
   */
  static async safeDefer(interaction, options = {}) {
    // Check if interaction is still valid
    if (interaction.replied || interaction.deferred) {
      logger.warn("Interaction already acknowledged, skipping");
      return false;
    }

    try {
      await interaction.deferReply(options);
      return true;
    } catch (error) {
      if (error.code === 10062) {
        logger.warn("Interaction expired before deferral");
        return false;
      }
      throw error;
    }
  }

  /**
   * Safely reply to an interaction with error handling
   * @param {Object} interaction - Discord interaction
   * @param {Object} options - Reply options
   * @returns {Promise<boolean>} Success status
   */
  static async safeReply(interaction, options) {
    try {
      if (interaction.deferred) {
        await interaction.editReply(options);
      } else if (!interaction.replied) {
        await interaction.reply(options);
      }
      return true;
    } catch (error) {
      logger.error("Error sending reply:", error);
      return false;
    }
  }

  /**
   * Check if interaction is valid for processing
   * @param {Object} interaction - Discord interaction
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {boolean} Is valid
   */
  static isValidInteraction(interaction, maxAge = 2500) {
    const interactionAge = Date.now() - interaction.createdTimestamp;

    if (interactionAge > maxAge) {
      logger.warn(
        `Interaction ${interaction.customId} is too old (${interactionAge}ms), skipping`,
      );
      return false;
    }

    return true;
  }

  /**
   * Handle Discord API errors gracefully
   * @param {Error} error - Error object
   * @param {Object} interaction - Discord interaction
   * @returns {boolean} Should continue processing
   */
  static handleApiError(error, _interaction) {
    if (error.code === 10062) {
      logger.warn("Interaction expired, cannot respond");
      return false;
    }

    if (error.code === 40060) {
      logger.warn("Interaction already acknowledged, cannot respond");
      return false;
    }

    return true;
  }
}
