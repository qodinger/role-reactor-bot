import { MessageFlags } from "discord.js";
import { getLogger } from "../logger.js";
import { EMOJIS } from "../../config/theme.js";

/**
 * Standardized error handling for interactions
 * Provides consistent error responses across all interaction types
 */

/**
 * Handle interaction errors with standardized responses
 * @param {import('discord.js').Interaction} interaction - The Discord interaction
 * @param {Error} error - The error that occurred
 * @param {string} context - Context about what was being done when the error occurred
 * @param {Object} options - Additional options for error handling
 * @param {boolean} options.deferred - Whether the interaction was already deferred
 * @param {boolean} options.replied - Whether the interaction was already replied to
 * @param {string} options.customMessage - Custom error message to show to user
 */
export async function handleInteractionError(
  interaction,
  error,
  context,
  options = {},
) {
  const logger = getLogger();
  const { deferred = false, replied = false, customMessage = null } = options;

  // Log the error with context
  logger.error(`Error in ${context}:`, error);

  // Determine the error message to show to the user
  const userMessage = customMessage || `An error occurred while ${context}.`;

  try {
    // Handle different interaction states
    if (replied) {
      // Interaction already replied, try to edit the reply
      if (interaction.editReply) {
        await interaction.editReply({
          content: `${EMOJIS.STATUS.ERROR} ${userMessage}`,
        });
      }
    } else if (deferred) {
      // Interaction was deferred, edit the reply
      await interaction.editReply({
        content: `${EMOJIS.STATUS.ERROR} ${userMessage}`,
      });
    } else {
      // Interaction not yet responded to, send a new reply
      await interaction.reply({
        content: `${EMOJIS.STATUS.ERROR} ${userMessage}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (replyError) {
    // If we can't even send an error message, log it
    logger.error("Failed to send error response to user:", replyError);
  }
}

/**
 * Handle button interaction errors specifically
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 * @param {Error} error - The error that occurred
 * @param {string} action - The action that failed
 */
export async function handleButtonError(interaction, error, action) {
  const logger = getLogger();

  logger.error(
    `Error handling button interaction ${interaction.customId} (${action}):`,
    error,
  );

  const userMessage = `An error occurred while ${action}.`;

  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: `${EMOJIS.STATUS.ERROR} ${userMessage}`,
        flags: MessageFlags.Ephemeral,
      });
    } else if (interaction.deferred) {
      await interaction.editReply({
        content: `${EMOJIS.STATUS.ERROR} ${userMessage}`,
      });
    }
  } catch (replyError) {
    logger.error("Error sending button error reply:", replyError);
  }
}

/**
 * Handle command interaction errors specifically
 * @param {import('discord.js').CommandInteraction} interaction - The command interaction
 * @param {Error} error - The error that occurred
 * @param {string} commandName - The name of the command that failed
 */
export async function handleCommandError(interaction, error, commandName) {
  const logger = getLogger();

  logger.error(`Error executing command ${commandName}:`, error);

  // Commands should handle their own errors, but provide a fallback
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: `${EMOJIS.STATUS.ERROR} An error occurred while executing this command.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (replyError) {
    logger.error("Error sending command error reply:", replyError);
  }
}

/**
 * Handle autocomplete interaction errors specifically
 * @param {import('discord.js').AutocompleteInteraction} interaction - The autocomplete interaction
 * @param {Error} error - The error that occurred
 * @param {string} commandName - The name of the command that failed
 */
export async function handleAutocompleteError(interaction, error, commandName) {
  const logger = getLogger();

  logger.error(`Error in autocomplete for ${commandName}:`, error);

  try {
    // For autocomplete, we should always respond with an empty array
    await interaction.respond([]);
  } catch (replyError) {
    logger.error("Error sending autocomplete error response:", replyError);
  }
}

/**
 * Validate interaction before processing
 * @param {import('discord.js').Interaction} interaction - The Discord interaction
 * @param {import('discord.js').Client} client - The Discord client
 * @returns {boolean} Whether the interaction is valid
 */
export function validateInteraction(interaction, client) {
  if (!interaction) {
    throw new Error("Interaction is null or undefined");
  }

  if (!client) {
    throw new Error("Client is null or undefined");
  }

  // Check if interaction is too old (Discord has a 3-second timeout)
  const now = Date.now();
  const created =
    interaction.createdTimestamp || interaction.createdAt?.getTime() || now;
  const age = now - created;

  if (age > 3000) {
    throw new Error(
      `Interaction is too old (${age}ms), Discord timeout is 3 seconds`,
    );
  }

  return true;
}

/**
 * Check if interaction can still be responded to
 * @param {import('discord.js').Interaction} interaction - The Discord interaction
 * @returns {boolean} Whether the interaction can still be responded to
 */
export function canRespondToInteraction(interaction) {
  return !interaction.replied && !interaction.deferred;
}

/**
 * Get appropriate response method for interaction
 * @param {import('discord.js').Interaction} interaction - The Discord interaction
 * @returns {string} The appropriate response method ('reply', 'editReply', 'followUp', or 'none')
 */
export function getResponseMethod(interaction) {
  if (interaction.replied) {
    return "followUp";
  } else if (interaction.deferred) {
    return "editReply";
  } else {
    return "reply";
  }
}
