import { MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";

/**
 * Safely defers a reply with timeout protection
 * @param {Object} interaction - Discord interaction object
 * @param {Object} options - Defer options
 * @param {number} timeoutMs - Timeout in milliseconds (default: 1000)
 * @returns {Object} Result with success boolean and error message
 */
export async function safeDeferReply(
  interaction,
  options = { flags: MessageFlags.Ephemeral },
  timeoutMs = 1000,
) {
  const logger = getLogger();

  try {
    // Check interaction age first - Discord interactions expire after 3 seconds
    const age = Date.now() - interaction.createdTimestamp;
    if (age > 2500) {
      // Leave 500ms buffer
      logger.warn("Interaction too old to defer", {
        interactionId: interaction.id,
        age,
        maxAge: 3000,
      });
      return { success: false, error: "Interaction too old" };
    }

    // Check if already acknowledged
    if (interaction.replied || interaction.deferred) {
      logger.debug("Interaction already acknowledged", {
        interactionId: interaction.id,
        replied: interaction.replied,
        deferred: interaction.deferred,
      });
      return { success: true, alreadyAcknowledged: true };
    }

    logger.debug("Attempting to defer reply", {
      interactionId: interaction.id,
      age,
      options,
    });

    // Simple deferral with timeout
    const deferPromise = interaction.deferReply(options);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("DeferReply timeout")), timeoutMs);
    });

    await Promise.race([deferPromise, timeoutPromise]);

    logger.debug("Successfully deferred reply", {
      interactionId: interaction.id,
      age,
    });

    return { success: true, deferred: true };
  } catch (error) {
    logger.debug("Deferral failed", {
      interactionId: interaction.id,
      error: error.message,
    });

    // If deferral with flags fails, try without flags as fallback
    if (
      error.message.includes("timeout") ||
      error.message.includes("Unknown interaction")
    ) {
      try {
        logger.debug("Trying deferral without flags", {
          interactionId: interaction.id,
        });

        const simpleDeferPromise = interaction.deferReply();
        const simpleTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Simple defer timeout")), 500);
        });

        await Promise.race([simpleDeferPromise, simpleTimeoutPromise]);

        logger.debug("Simple deferral successful", {
          interactionId: interaction.id,
        });

        return { success: true, deferred: true };
      } catch (simpleError) {
        logger.debug("All deferral attempts failed", {
          interactionId: interaction.id,
          originalError: error.message,
          simpleError: simpleError.message,
        });

        return { success: false, error: "Deferral failed" };
      }
    }

    return { success: false, error: error.message };
  }
}

/**
 * Handles deferral for schedule-role commands
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Deferral result
 */
export async function handleDeferral(interaction) {
  const logger = getLogger();

  try {
    // Check interaction age
    const age = Date.now() - interaction.createdTimestamp;
    logger.debug("Interaction age check", {
      age,
      maxAge: 3000,
      interactionId: interaction.id,
    });

    if (age > 2500) {
      logger.warn("Interaction too old, skipping deferral", {
        interactionId: interaction.id,
        age,
      });
      return { success: false, error: "Interaction too old" };
    }

    // Check if already acknowledged
    if (interaction.replied || interaction.deferred) {
      logger.debug("Interaction already acknowledged", {
        interactionId: interaction.id,
        replied: interaction.replied,
        deferred: interaction.deferred,
      });
      return {
        success: true,
        alreadyAcknowledged: true,
        deferred: interaction.deferred,
      };
    }

    // Attempt deferral
    const result = await safeDeferReply(interaction);

    logger.debug("Deferral result", {
      interactionId: interaction.id,
      success: result.success,
      error: result.error,
      alreadyAcknowledged: result.alreadyAcknowledged,
    });

    return result;
  } catch (error) {
    logger.error("Error in handleDeferral", {
      interactionId: interaction.id,
      error: error.message,
    });

    return { success: false, error: error.message };
  }
}

/**
 * Sends a response to an interaction
 * @param {Object} interaction - Discord interaction object
 * @param {Object} response - Response object
 * @param {boolean} deferred - Whether the interaction was deferred
 */
export async function sendResponse(interaction, response, deferred) {
  const logger = getLogger();

  try {
    logger.debug("Attempting to send response", {
      interactionId: interaction.id,
      deferred,
      interactionReplied: interaction.replied,
      interactionDeferred: interaction.deferred,
      responseKeys: Object.keys(response),
      hasEmbeds: !!response.embeds,
      embedsCount: response.embeds?.length || 0,
    });

    // Fix deprecated ephemeral warning by converting to flags
    const finalResponse = { ...response };
    if (finalResponse.ephemeral) {
      finalResponse.flags = 64; // MessageFlags.Ephemeral
      delete finalResponse.ephemeral;
    }

    // Check Discord's internal state first - this is the most reliable
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(finalResponse);
      logger.debug(
        "Successfully sent response (interaction already acknowledged)",
        {
          interactionId: interaction.id,
        },
      );
    } else if (deferred) {
      // Our deferral succeeded, use editReply
      await interaction.editReply(finalResponse);
      logger.debug("Successfully sent deferred response", {
        interactionId: interaction.id,
      });
    } else {
      // No deferral, try to reply
      await interaction.reply(finalResponse);
      logger.debug("Successfully sent immediate response", {
        interactionId: interaction.id,
      });
    }
  } catch (error) {
    logger.error("Failed to send response", {
      error: error.message,
      interactionId: interaction.id,
      deferred,
      interactionReplied: interaction.replied,
      interactionDeferred: interaction.deferred,
      responseKeys: Object.keys(response),
    });
    throw error;
  }
}
