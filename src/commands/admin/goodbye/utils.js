import { getLogger } from "../../../utils/logger.js";

/**
 * Validate goodbye input parameters
 * @param {Object} inputs - Input parameters
 * @returns {Object} Validation result
 */
export function validateGoodbyeInputs(inputs) {
  const { channel, message } = inputs;

  // Validate channel
  if (channel) {
    if (!channel.isTextBased()) {
      return {
        valid: false,
        error: "The goodbye channel must be a text-based channel.",
      };
    }

    if (!channel.permissionsFor(channel.guild.members.me).has("SendMessages")) {
      return {
        valid: false,
        error:
          "I don't have permission to send messages in the selected channel.",
      };
    }
  }

  // Validate message length
  if (message && message.length > 2000) {
    return {
      valid: false,
      error: "Goodbye message cannot exceed 2000 characters.",
    };
  }

  return { valid: true };
}

/**
 * Process goodbye settings from input parameters
 * @param {Object} currentSettings - Current goodbye settings
 * @param {Object} inputs - Input parameters
 * @returns {Object} Processed settings
 */
export function processGoodbyeSettings(currentSettings, inputs) {
  const { channel, message, enabled, embed } = inputs;

  const newSettings = { ...currentSettings };

  // Update channel
  if (channel) {
    newSettings.channelId = channel.id;
  }

  // Update message
  if (message !== null) {
    newSettings.message = message;
  }

  // Update enabled status
  if (enabled !== null) {
    newSettings.enabled = enabled;
  }

  // Update embed format
  if (embed !== null) {
    newSettings.embedEnabled = embed;
  }

  return newSettings;
}

/**
 * Log goodbye setup activity
 * @param {import('discord.js').User} user - User who set up goodbye
 * @param {import('discord.js').Guild} guild - Guild where goodbye was set up
 * @param {Object} settings - Goodbye settings
 */
export function logGoodbyeSetup(user, guild, settings) {
  const logger = getLogger();
  logger.info(
    `Goodbye system configured by ${user.tag} (${user.id}) in ${guild.name} (${guild.id})`,
    {
      enabled: settings.enabled,
      channelId: settings.channelId,
      embedEnabled: settings.embedEnabled,
    },
  );
}
