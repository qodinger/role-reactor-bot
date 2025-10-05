import { getLogger } from "../../../utils/logger.js";

/**
 * Validates if an interaction is still valid and can be processed
 * @param {Object} interaction - Discord interaction object
 * @param {number} maxAge - Maximum age in milliseconds (default: 3000)
 * @returns {Object} Validation result with success boolean and error message
 */
export function validateInteraction(interaction, maxAge = 3000) {
  const logger = getLogger();

  // Check if already acknowledged
  if (interaction.replied || interaction.deferred) {
    logger.warn("Interaction already acknowledged", {
      interactionId: interaction.id,
      replied: interaction.replied,
      deferred: interaction.deferred,
    });
    return {
      success: false,
      error: "Interaction already acknowledged",
      skipCleanup: true,
    };
  }

  // Check if interaction has expired
  const interactionAge = Date.now() - interaction.createdTimestamp;
  logger.debug("Interaction age check", {
    age: interactionAge,
    maxAge,
    interactionId: interaction.id,
  });

  if (interactionAge > maxAge) {
    logger.warn("Interaction has expired", {
      age: interactionAge,
      maxAge,
      interactionId: interaction.id,
    });
    return {
      success: false,
      error: "Interaction has expired",
      skipCleanup: true,
    };
  }

  return { success: true };
}

/**
 * Validates if the bot member is available for permission checks
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Validation result with success boolean and error response
 */
export function validateBotMember(interaction) {
  const logger = getLogger();

  if (!interaction.guild.members.me) {
    logger.error("Bot member not available", {
      guildId: interaction.guild.id,
      guildName: interaction.guild.name,
    });

    return {
      success: false,
      errorResponse: {
        title: "Bot Permission Error",
        description: "I cannot access my member information in this server.",
        solution:
          "Please make sure I have the necessary permissions and try again.",
        fields: [
          {
            name: "🔧 How to Fix",
            value:
              "1. Go to **Server Settings** → **Roles**\n2. Make sure my role (Role Reactor) exists\n3. Grant me basic permissions like **View Channels**\n4. Try the command again",
            inline: false,
          },
        ],
      },
    };
  }

  return { success: true };
}

/**
 * Creates a standardized error response for interaction validation failures
 * @param {string} error - Error message
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Error response object
 */
export function createValidationErrorResponse(error, interaction) {
  const logger = getLogger();

  logger.warn("Interaction validation failed", {
    error,
    interactionId: interaction.id,
    user: interaction.user.username,
  });

  return {
    title: "Interaction Error",
    description: error,
    solution: "Please try the command again.",
  };
}
