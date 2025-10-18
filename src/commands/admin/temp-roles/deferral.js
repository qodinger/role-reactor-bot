import { MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";

const logger = getLogger();

/**
 * Safely defer a reply with aggressive timeout handling
 * @param {Object} interaction - Discord interaction
 * @param {Object} options - Defer options
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Object>} Result with success boolean
 */
export async function safeDeferReply(
  interaction,
  options = { flags: MessageFlags.Ephemeral },
  timeoutMs = 100, // Extremely aggressive timeout for slow Discord API
) {
  try {
    // Add pre-deferral timing check
    logger.debug("Pre-deferral check:", {
      interactionId: interaction.id,
      isRepliable: interaction.isRepliable(),
      createdTimestamp: interaction.createdTimestamp,
      currentTime: Date.now(),
      ageAtCheck: Date.now() - interaction.createdTimestamp,
    });

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

    const deferStartTime = Date.now();
    try {
      await Promise.race([deferPromise, timeoutPromise]);
    } catch (timeoutError) {
      // If deferral with flags fails, try without flags as fallback
      if (timeoutError.message.includes("timeout")) {
        logger.debug("Deferral with flags timed out, trying without flags", {
          interactionId: interaction.id,
        });

        const simpleDeferPromise = interaction.deferReply();
        const simpleTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Simple defer timeout")), 50);
        });

        try {
          await Promise.race([simpleDeferPromise, simpleTimeoutPromise]);
          logger.debug("Simple deferral successful", {
            interactionId: interaction.id,
          });
        } catch (_simpleError) {
          throw timeoutError; // Throw original timeout error
        }
      } else {
        throw timeoutError;
      }
    }
    const deferEndTime = Date.now();

    logger.debug("Successfully deferred reply", {
      interactionId: interaction.id,
      deferDuration: deferEndTime - deferStartTime,
      totalAge: deferEndTime - interaction.createdTimestamp,
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
      // Try immediate reply as fallback with ultra-short timeout
      try {
        logger.debug("Attempting immediate reply as fallback", {
          interactionId: interaction.id,
        });

        // Ultra-short timeout for fallback attempt
        const fallbackPromise = interaction.reply({
          content: "⏳ Processing your request...",
          flags: MessageFlags.Ephemeral,
        });
        const fallbackTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Fallback reply timeout")), 100);
        });

        await Promise.race([fallbackPromise, fallbackTimeout]);
        logger.debug("Fallback reply successful", {
          interactionId: interaction.id,
        });
        return { success: true, fallback: true };
      } catch (fallbackError) {
        logger.error("Fallback reply also failed", {
          interactionId: interaction.id,
          error: fallbackError.message,
        });

        // If fallback also fails, mark as handled to prevent further processing
        interaction._handled = true;
      }

      // If both deferral and fallback failed, try one final emergency response
      try {
        logger.debug("Attempting emergency response", {
          interactionId: interaction.id,
        });

        // Try to send a simple error message without any special flags
        await interaction.reply({
          content: "❌ Command timed out. Please try again.",
        });

        logger.debug("Emergency response successful", {
          interactionId: interaction.id,
        });
        return { success: true, emergency: true };
      } catch (emergencyError) {
        logger.error("Emergency response also failed", {
          interactionId: interaction.id,
          error: emergencyError.message,
        });
      }

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
 * Handle deferral with fallback mechanisms
 * @param {Object} interaction - Discord interaction
 * @returns {Promise<boolean>} Success status
 */
export async function handleDeferral(interaction) {
  const deferResult = await safeDeferReply(interaction);

  if (!deferResult.success) {
    logger.warn("Failed to defer interaction", {
      interactionId: interaction.id,
      error: deferResult.error,
      isExpired: deferResult.isExpired,
    });

    // Mark interaction as handled to prevent further processing
    if (deferResult.isExpired) {
      interaction._handled = true;
    }
  }

  return deferResult.success;
}
