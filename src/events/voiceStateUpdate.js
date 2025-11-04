import { getLogger } from "../utils/logger.js";
import { getVoiceTracker } from "../features/experience/VoiceTracker.js";
import { enforceVoiceRestrictions as defaultEnforceVoiceRestrictions } from "../utils/discord/voiceRestrictions.js";

/**
 * Handle voice state updates for XP tracking and voice restrictions
 * @param {import('discord.js').VoiceState} oldState - Previous voice state
 * @param {import('discord.js').VoiceState} newState - New voice state
 * @param {Object} [options] - Optional parameters
 * @param {Promise<Object>|Object} [options.voiceTracker] - Voice tracker instance (for testing)
 */
export async function execute(oldState, newState, options = {}) {
  const logger = getLogger();

  try {
    // Skip if not in a guild
    if (!newState.guild) return;

    const guildId = newState.guild.id;
    const member = newState.member;
    if (!member) return;

    const userId = member.id;
    // Allow dependency injection for testing
    const voiceTracker = options.voiceTracker
      ? await Promise.resolve(options.voiceTracker)
      : await getVoiceTracker();

    // Check if user is in a voice channel (or just joined/switched)
    const isInVoiceChannel = !!newState.channelId;
    const justJoined = !oldState.channelId && newState.channelId;
    const switchedChannels =
      oldState.channelId &&
      newState.channelId &&
      oldState.channelId !== newState.channelId;
    const muteStatusChanged = oldState.mute !== newState.mute;
    const selfMuted = newState.selfMute !== oldState.selfMute;

    // Check if user is muted but no longer has restrictive Speak role
    // This handles the case where a restrictive role was removed
    // Check this whenever user is in voice and muted (not just on state changes)
    if (isInVoiceChannel && newState.mute && !newState.selfMute) {
      const channel = newState.channel;
      if (channel) {
        logger.debug(
          `Checking if muted user ${member.user.tag} should be unmuted in channel ${channel.name}`,
        );

        // Refresh member to ensure we have latest roles
        try {
          await member.fetch();
        } catch (error) {
          logger.debug(
            `Failed to refresh member ${member.user.tag}:`,
            error.message,
          );
        }

        // Allow dependency injection for testing
        const enforceVoiceRestrictions =
          options.enforceVoiceRestrictions || defaultEnforceVoiceRestrictions;

        // Enforce voice restrictions (this will unmute if no restrictive role exists)
        const result = await enforceVoiceRestrictions(
          member,
          "Voice state update - checking unmute",
        );

        // Log the result
        if (result.unmuted) {
          logger.info(
            `✅ Unmuted ${member.user.tag} in voiceStateUpdate - no longer has restrictive Speak role`,
          );
        } else if (result.muted) {
          // User was muted (shouldn't happen here since they're already muted)
          logger.debug(`User ${member.user.tag} was muted in voiceStateUpdate`);
        } else if (result.needsPermission) {
          // Bot needs permission - log this clearly
          logger.warn(
            `⚠️ Bot needs "Mute Members" permission to unmute ${member.user.tag}. ` +
              `Enable this permission in Server Settings → Roles → [Bot's Role] → General Permissions.`,
          );
        } else if (result.error) {
          logger.warn(
            `⚠️ Failed to process unmute for ${member.user.tag}: ${result.error}`,
          );
        } else {
          // User still has restrictive role or other reason
          logger.debug(
            `User ${member.user.tag} still has restrictive Speak role or other condition - not unmuting`,
          );
        }
      }
    }

    // Check if user tried to unmute themselves (when they have restrictive role)
    // OR if user is currently muted - check if they should be unmuted
    // This handles both: preventing unmute when they have restrictive role,
    // AND unmuting them when they don't have restrictive role anymore
    if (isInVoiceChannel && (muteStatusChanged || selfMuted || newState.mute)) {
      const channel = newState.channel;
      // Check if user went from muted to unmuted (trying to unmute)
      const wasMuted = oldState.mute || oldState.selfMute;
      const isUnmuted = !newState.mute && !newState.selfMute;
      const isCurrentlyMuted = newState.mute && !newState.selfMute;

      // If user tried to unmute OR is currently muted, check their status
      if (channel && ((wasMuted && isUnmuted) || isCurrentlyMuted)) {
        // User is trying to unmute - check if they have a role with Speak disabled
        const botMember = channel.guild.members.me;
        const hasMuteMembers =
          botMember?.permissions.has("MuteMembers") ?? false;

        if (hasMuteMembers) {
          let hasRestrictiveSpeakRole = false;
          let restrictiveSpeakRoleName = null;

          // Refresh member to ensure we have latest roles
          try {
            await member.fetch();
          } catch (error) {
            logger.debug(
              `Failed to refresh member ${member.user.tag}:`,
              error.message,
            );
          }

          // Check each role for Speak permission
          for (const role of member.roles.cache.values()) {
            const rolePermissions = channel.permissionsFor(role);
            const canSpeak = rolePermissions?.has("Speak") ?? true;

            // Check channel overrides for this role
            const channelOverrides = channel.permissionOverwrites.cache.get(
              role.id,
            );
            const overrideAllowsSpeak = channelOverrides
              ? channelOverrides.allow.has("Speak")
              : false;
            const overrideDeniesSpeak = channelOverrides
              ? channelOverrides.deny.has("Speak")
              : false;

            // If role has Speak disabled (either explicitly denied or not granted)
            // AND there's no override allowing Speak
            if ((!canSpeak || overrideDeniesSpeak) && !overrideAllowsSpeak) {
              hasRestrictiveSpeakRole = true;
              restrictiveSpeakRoleName = role.name;
              logger.debug(
                `User ${member.user.tag} tried to unmute but has role ${role.name} with Speak disabled in channel ${channel.name}`,
              );
              break;
            }
          }

          // If user has a restrictive Speak role, mute them again
          if (hasRestrictiveSpeakRole) {
            try {
              await member.voice.setMute(
                true,
                `Restrictive role "${restrictiveSpeakRoleName}": Speak permission denied`,
              );
              logger.info(
                `🔇 Re-muted ${member.user.tag} in voice channel ${channel.name} due to restrictive role "${restrictiveSpeakRoleName}" (Speak disabled) - user tried to unmute`,
              );
            } catch (muteError) {
              logger.warn(
                `Failed to mute ${member.user.tag} in voice channel:`,
                muteError.message,
              );
            }
          } else {
            // User doesn't have restrictive role - use centralized utility to unmute
            logger.debug(
              `User ${member.user.tag} tried to unmute and has no restrictive Speak role - allowing unmute or unmuting if needed`,
            );
            // Allow dependency injection for testing
            const enforceVoiceRestrictions =
              options.enforceVoiceRestrictions ||
              defaultEnforceVoiceRestrictions;
            const result = await enforceVoiceRestrictions(
              member,
              "User tried to unmute - checking restrictions",
            );
            if (result.unmuted) {
              logger.info(
                `✅ Unmuted ${member.user.tag} after unmute attempt - no restrictive role found`,
              );
            } else if (result.error) {
              logger.warn(
                `⚠️ Failed to process unmute for ${member.user.tag}: ${result.error}`,
              );
            }
          }
        } else {
          logger.debug(
            `Bot missing MuteMembers permission - cannot check/unmute ${member.user.tag}`,
          );
        }
      }
    }

    // Check if user joined a voice channel (new connection or switched channels)
    // This prevents users with restrictive roles from joining voice channels
    if (justJoined || switchedChannels) {
      const channel = newState.channel;
      if (channel) {
        // Refresh member to ensure we have the latest role information
        try {
          await member.fetch();
        } catch (error) {
          logger.debug(
            `Failed to refresh member ${member.user.tag}:`,
            error.message,
          );
        }

        // Allow dependency injection for testing
        const enforceVoiceRestrictions =
          options.enforceVoiceRestrictions || defaultEnforceVoiceRestrictions;

        // Use centralized voice restriction enforcement
        const reason = justJoined
          ? "User joined voice channel"
          : "User switched voice channels";

        const result = await enforceVoiceRestrictions(member, reason);

        // Log the result
        if (result.disconnected) {
          logger.info(
            `🚫 Disconnected ${member.user.tag} from voice channel ${channel.name} - restrictive role detected`,
          );
          return; // Don't track voice time for disconnected users
        } else if (result.muted) {
          logger.info(
            `🔇 Muted ${member.user.tag} in voice channel ${channel.name} - restrictive Speak role detected`,
          );
        } else if (result.error) {
          logger.warn(
            `⚠️ Voice restriction enforcement failed for ${member.user.tag}: ${result.error}`,
          );
          // Continue to allow voice tracking even if enforcement failed
        }
      }
    }

    // User joined a voice channel
    if (!oldState.channelId && newState.channelId) {
      await voiceTracker.startVoiceTracking(
        guildId,
        userId,
        newState.channelId,
      );
      logger.debug(
        `🎤 User ${userId} joined voice channel ${newState.channelId} in guild ${guildId}`,
      );
    }

    // User left a voice channel
    else if (oldState.channelId && !newState.channelId) {
      await voiceTracker.stopVoiceTracking(guildId, userId);
      logger.debug(`🎤 User ${userId} left voice channel in guild ${guildId}`);
    }

    // User switched voice channels
    else if (
      oldState.channelId &&
      newState.channelId &&
      oldState.channelId !== newState.channelId
    ) {
      // Stop tracking old channel
      await voiceTracker.stopVoiceTracking(guildId, userId);
      // Start tracking new channel
      await voiceTracker.startVoiceTracking(
        guildId,
        userId,
        newState.channelId,
      );
      logger.debug(
        `🎤 User ${userId} switched from channel ${oldState.channelId} to ${newState.channelId} in guild ${guildId}`,
      );
    }
  } catch (error) {
    logger.error("Error handling voice state update:", error);
  }
}

export const name = "voiceStateUpdate";
export const once = false;
