import { getLogger } from "../../../utils/logger.js";
import { sanitizeInput } from "../../../utils/discord/inputUtils.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";

/**
 * Validate welcome system inputs
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Channel} channel
 * @param {import('discord.js').Role} autoRole
 * @param {boolean} enabled
 * @returns {Object}
 */
export function validateWelcomeInputs(interaction, channel, autoRole, enabled) {
  // Handle enabled status - only allow enabling if channel is provided
  if (enabled !== null) {
    if (enabled && !channel) {
      return {
        isValid: false,
        errorEmbed: errorEmbed({
          title: "Cannot Enable Without Channel",
          description:
            "You must specify a channel to enable the welcome system.",
          solution:
            "Use `/welcome setup channel:#your-channel enabled:true` to enable with a channel.",
        }),
      };
    }
  }

  // Validate auto-role permissions if provided
  if (autoRole) {
    if (
      autoRole.position >= interaction.guild.members.me.roles.highest.position
    ) {
      return {
        isValid: false,
        errorEmbed: errorEmbed({
          title: "Auto-Role Permission Error",
          description: `I cannot assign the role ${autoRole.toString()} because it's higher than or equal to my highest role.`,
          solution:
            "Please move my role above the auto-role or choose a different role.",
        }),
      };
    }
  }

  return { isValid: true };
}

/**
 * Process welcome settings and create new settings object
 * @param {Object} currentSettings
 * @param {import('discord.js').Channel} channel
 * @param {string} message
 * @param {import('discord.js').Role} autoRole
 * @param {boolean} enabled
 * @param {boolean} embedEnabled
 * @returns {Object}
 */
export function processWelcomeSettings(
  currentSettings,
  channel,
  message,
  autoRole,
  enabled,
  embedEnabled,
) {
  // Prepare new settings
  const newSettings = {
    ...currentSettings,
    channelId: channel.id,
    embedEnabled:
      embedEnabled !== null ? embedEnabled : currentSettings.embedEnabled,
  };

  // Handle enabled status - only allow enabling if channel is provided
  if (enabled !== null) {
    newSettings.enabled = enabled;
  } else {
    // If no enabled option provided, only enable if channel is being set
    newSettings.enabled = channel ? currentSettings.enabled || true : false;
  }

  // Update message if provided
  if (message) {
    newSettings.message = sanitizeInput(message);
  }

  // Update auto-role if provided
  if (autoRole) {
    newSettings.autoRoleId = autoRole.id;
  }

  return newSettings;
}

/**
 * Log welcome system configuration
 * @param {string} guildId
 * @param {string} userId
 * @param {Object} settings
 */
export function logWelcomeConfiguration(guildId, userId, settings) {
  const logger = getLogger();
  logger.info(
    `Welcome system configured - Guild: ${guildId}, User: ${userId}`,
    {
      enabled: settings.enabled,
      channelId: settings.channelId,
      embedEnabled: settings.embedEnabled,
      hasAutoRole: !!settings.autoRoleId,
      hasCustomMessage: !!settings.message,
    },
  );
}
