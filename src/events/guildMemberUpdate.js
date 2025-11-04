import { Events } from "discord.js";
import { getLogger } from "../utils/logger.js";
import { enforceVoiceRestrictions as defaultEnforceVoiceRestrictions } from "../utils/discord/voiceRestrictions.js";

/**
 * Handle guild member updates (including role changes)
 * This catches role changes even when users are already in voice channels
 * @param {import("discord.js").GuildMember} oldMember - Previous member state
 * @param {import("discord.js").GuildMember} newMember - New member state
 * @param {import("discord.js").Client} _client - Discord client (passed by event handler, unused)
 * @param {Object} [options] - Optional parameters
 * @param {Function} [options.enforceVoiceRestrictions] - Voice restrictions function (for testing)
 */
export async function execute(oldMember, newMember, _client, options = {}) {
  const logger = getLogger();

  try {
    // Skip if not in a guild
    if (!newMember.guild) return;

    // Only process if roles changed
    if (oldMember.roles.cache.size === newMember.roles.cache.size) {
      // Check if roles actually changed (not just count)
      const oldRoleIds = oldMember.roles.cache.map(r => r.id).sort();
      const newRoleIds = newMember.roles.cache.map(r => r.id).sort();
      const rolesChanged =
        oldRoleIds.length !== newRoleIds.length ||
        oldRoleIds.some((id, idx) => id !== newRoleIds[idx]);

      if (!rolesChanged) {
        return; // No role changes, skip
      }
    }

    // Member is in a voice channel - check voice restrictions
    if (newMember.voice?.channel) {
      // Refresh member to ensure we have latest role information
      try {
        await newMember.fetch();
      } catch (error) {
        logger.debug(
          `Failed to refresh member ${newMember.user.tag} in guildMemberUpdate:`,
          error.message,
        );
      }

      logger.debug(
        `Role change detected for ${newMember.user.tag} in voice channel ${newMember.voice.channel.name} - enforcing voice restrictions`,
      );

      // Allow dependency injection for testing
      const enforceVoiceRestrictions =
        options.enforceVoiceRestrictions || defaultEnforceVoiceRestrictions;

      // Enforce voice restrictions based on current roles
      const result = await enforceVoiceRestrictions(
        newMember,
        "Role change detected",
      );

      // Log the result for debugging
      if (result.unmuted) {
        logger.info(
          `✅ Unmuted ${newMember.user.tag} after role removal in guildMemberUpdate`,
        );
      } else if (result.muted) {
        logger.info(
          `✅ Muted ${newMember.user.tag} after role assignment in guildMemberUpdate`,
        );
      } else if (result.error) {
        logger.warn(
          `⚠️ Voice restriction enforcement failed for ${newMember.user.tag}: ${result.error}`,
        );
      }
    }
  } catch (error) {
    logger.error("Error handling guild member update:", error);
  }
}

export const name = Events.GuildMemberUpdate;
export const once = false;
