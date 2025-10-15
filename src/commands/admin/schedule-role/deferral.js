import { MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";

/**
 * Safely defers a reply with timeout protection
 * @param {Object} interaction - Discord interaction object
 * @param {Object} options - Defer options
 * @param {number} timeoutMs - Timeout in milliseconds (default: 2000)
 * @returns {Object} Result with success boolean and error message
 */
export async function safeDeferReply(
  interaction,
  options = { flags: MessageFlags.Ephemeral },
  timeoutMs = 2000,
) {
  const logger = getLogger();

  try {
    logger.debug("Attempting to defer reply", {
      interactionId: interaction.id,
      options,
      timeoutMs,
    });

    // Add timeout protection
    const deferPromise = interaction.deferReply(options);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("DeferReply timeout")), timeoutMs);
    });

    await Promise.race([deferPromise, timeoutPromise]);
    logger.debug("Successfully deferred reply", {
      interactionId: interaction.id,
    });

    return { success: true };
  } catch (error) {
    logger.error("Failed to defer reply", {
      error: error.message,
      interactionId: interaction.id,
      interactionAge: Date.now() - interaction.createdTimestamp,
    });

    // Check if it's a timeout or unknown interaction error
    if (
      error.message.includes("timeout") ||
      error.message.includes("Unknown interaction")
    ) {
      return {
        success: false,
        error: "Interaction expired or timed out",
        isExpired: true,
      };
    }

    return {
      success: false,
      error: error.message,
      isExpired: false,
    };
  }
}

/**
 * Handles deferral with fallback for already acknowledged interactions
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Result with success boolean and deferred status
 */
export async function handleDeferral(interaction) {
  const logger = getLogger();

  try {
    // Check if already acknowledged
    if (interaction.replied || interaction.deferred) {
      logger.debug("Interaction already acknowledged", {
        interactionId: interaction.id,
        replied: interaction.replied,
        deferred: interaction.deferred,
      });
      return { success: true, alreadyAcknowledged: true };
    }

    // Attempt to defer
    const deferResult = await safeDeferReply(interaction);
    if (deferResult.success) {
      return { success: true, alreadyAcknowledged: false };
    }

    // Handle deferral failure
    if (deferResult.isExpired) {
      logger.warn("Interaction expired during deferral", {
        interactionId: interaction.id,
      });
      return { success: false, error: "Interaction expired" };
    }

    return { success: false, error: deferResult.error };
  } catch (error) {
    logger.error("Unexpected error in deferral handling", {
      error: error.message,
      interactionId: interaction.id,
    });
    return { success: false, error: error.message };
  }
}

/**
 * Sends a response with proper handling for deferred vs non-deferred interactions
 * @param {Object} interaction - Discord interaction object
 * @param {Object} response - Response object
 * @param {boolean} deferred - Whether interaction was deferred
 * @returns {Promise<void>}
 */
export async function sendResponse(interaction, response, deferred) {
  const logger = getLogger();

  try {
    logger.debug("Attempting to send response", {
      interactionId: interaction.id,
      deferred,
      responseKeys: Object.keys(response),
      hasEmbeds: !!response.embeds,
      embedsCount: response.embeds?.length || 0,
    });

    if (deferred) {
      await interaction.editReply(response);
      logger.debug("Successfully sent deferred response", {
        interactionId: interaction.id,
      });
    } else {
      await interaction.reply({ ...response, flags: 64 });
      logger.debug("Successfully sent immediate response", {
        interactionId: interaction.id,
      });
    }
  } catch (error) {
    logger.error("Failed to send response", {
      error: error.message,
      interactionId: interaction.id,
      deferred,
      responseKeys: Object.keys(response),
    });
    throw error;
  }
}
