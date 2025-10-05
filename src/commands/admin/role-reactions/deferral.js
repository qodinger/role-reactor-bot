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
  options = { flags: 64 },
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
 * Safely defers an update for button interactions
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Result with success boolean and error message
 */
export async function safeDeferUpdate(interaction) {
  const logger = getLogger();

  try {
    await interaction.deferUpdate();
    logger.debug("Successfully deferred update", {
      interactionId: interaction.id,
    });
    return { success: true };
  } catch (error) {
    logger.error("Failed to defer update", {
      error: error.message,
      interactionId: interaction.id,
    });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Handles deferral based on interaction type
 * @param {Object} interaction - Discord interaction object
 * @param {boolean} isButtonUpdate - Whether this is a button update
 * @returns {Object} Result with success boolean and error message
 */
export async function handleDeferral(interaction, isButtonUpdate = false) {
  const logger = getLogger();

  if (isButtonUpdate) {
    logger.debug("Handling button update deferral");
    return await safeDeferUpdate(interaction);
  } else {
    logger.debug("Handling command deferral");
    return await safeDeferReply(interaction);
  }
}
