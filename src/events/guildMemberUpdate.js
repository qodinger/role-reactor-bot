import { Events } from "discord.js";
import { getLogger } from "../utils/logger.js";
import { getVoiceOperationQueue } from "../utils/discord/voiceOperationQueue.js";

/**
 * Handle guild member updates (including role changes)
 * This catches role changes even when users are already in voice channels
 * @param {import("discord.js").GuildMember} oldMember - Previous member state
 * @param {import("discord.js").GuildMember} newMember - New member state
 * @param {import("discord.js").Client} _client - Discord client (passed by event handler, unused)
 */
export async function execute(oldMember, newMember, _client) {
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
        `Role change detected for ${newMember.user.tag} in voice channel ${newMember.voice.channel.name} - queuing voice operation`,
      );

      // Use global queue for voice operations
      const voiceQueue = getVoiceOperationQueue();

      // Find the role that was removed (for logging)
      const removedRole = oldMember.roles.cache.find(
        role => !newMember.roles.cache.has(role.id),
      );

      // Queue the operation - queue will handle enforcement and logging
      voiceQueue
        .queueOperation({
          member: newMember,
          role: removedRole || { name: "Unknown" },
          reason: "Role change detected",
          type: "enforce",
        })
        .catch(error => {
          logger.debug(
            `Failed to queue voice operation for ${newMember.user.tag}:`,
            error.message,
          );
        });
    }
  } catch (error) {
    logger.error("Error handling guild member update:", error);
  }
}

export const name = Events.GuildMemberUpdate;
export const once = false;
