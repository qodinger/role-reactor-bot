import { getLogger } from "../utils/logger.js";
import { getVoiceTracker } from "../features/experience/VoiceTracker.js";
import { enforceVoiceRestrictions } from "../utils/discord/voiceRestrictions.js";

/**
 * Handle voice state updates for XP tracking and voice restrictions
 * @param {import('discord.js').VoiceState} oldState - Previous voice state
 * @param {import('discord.js').VoiceState} newState - New voice state
 */
export async function execute(oldState, newState) {
  const logger = getLogger();

  try {
    // Skip if not in a guild
    if (!newState.guild) return;

    const guildId = newState.guild.id;
    const member = newState.member;
    if (!member) return;

    const userId = member.id;
    const voiceTracker = await getVoiceTracker();

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

        // Get bot permissions once for all checks
        const botMember = channel.guild.members.me;
        const hasMoveMembers =
          botMember?.permissions.has("MoveMembers") ?? false;
        const hasMuteMembers =
          botMember?.permissions.has("MuteMembers") ?? false;

        // Check if user has any restrictive role (role with Connect disabled)
        // This is more reliable than checking overall permissions, which can be
        // overridden by other roles that allow Connect
        let hasRestrictiveRole = false;
        let restrictiveRoleName = null;

        // Check each role the user has to see if any has Connect disabled
        // We need to check if the role has Connect disabled in voice channels
        // This is independent of other roles - if a user has a restrictive role,
        // they should be disconnected regardless of other roles
        for (const role of member.roles.cache.values()) {
          // Check channel permission overrides for this role FIRST
          // This tells us if there's an explicit override for this role
          const channelOverrides = channel.permissionOverwrites.cache.get(
            role.id,
          );
          const hasChannelOverride = !!channelOverrides;
          const channelOverrideAllowsConnect = channelOverrides
            ? channelOverrides.allow.has("Connect")
            : false;
          const channelOverrideDeniesConnect = channelOverrides
            ? channelOverrides.deny.has("Connect")
            : false;

          // Check role's effective permissions in this channel
          // Note: channel.permissionsFor(role) includes channel overrides,
          // so we need to check both the override and the effective permissions
          const rolePermissions = channel.permissionsFor(role);
          const roleCanConnectEffective =
            rolePermissions?.has("Connect") ?? true;

          // Determine if the role has Connect disabled at the ROLE level
          // The logic is:
          // 1. If override explicitly denies Connect → role has Connect disabled
          // 2. If override explicitly allows Connect → role does NOT have Connect disabled (override takes precedence)
          // 3. If no override or override doesn't set Connect → check effective permissions
          //    - If effective permissions show Connect disabled → role has Connect disabled
          //    - If effective permissions show Connect enabled BUT there's an override that doesn't allow it,
          //      the role might still have Connect disabled at role level (check other voice channels)
          let roleHasConnectDisabled = false;

          if (channelOverrideDeniesConnect) {
            // Channel override explicitly denies Connect - role has Connect disabled
            roleHasConnectDisabled = true;
          } else if (channelOverrideAllowsConnect) {
            // Channel override explicitly allows Connect - override takes precedence, role does NOT have Connect disabled
            roleHasConnectDisabled = false;
          } else if (!hasChannelOverride && !roleCanConnectEffective) {
            // No override exists, and effective permissions show Connect disabled
            // This means the role has Connect disabled at the role level
            roleHasConnectDisabled = true;
          } else if (hasChannelOverride && !roleCanConnectEffective) {
            // Override exists but doesn't allow/deny Connect, and effective permissions show disabled
            // This means the role has Connect disabled and override doesn't help
            roleHasConnectDisabled = true;
          } else if (
            hasChannelOverride &&
            !channelOverrideAllowsConnect &&
            roleCanConnectEffective
          ) {
            // Edge case: Override exists for this role but doesn't allow Connect,
            // yet effective permissions show enabled (likely due to @everyone override or other factors)
            // We need to check if the role itself has Connect disabled at the role level
            // by checking its permissions in other voice channels
            const otherVoiceChannels = channel.guild.channels.cache.filter(
              ch =>
                ch.isVoiceBased() &&
                ch.id !== channel.id &&
                ch.type === channel.type,
            );

            // Check if role has Connect disabled in other voice channels
            // If the role has Connect disabled in ANY other voice channel, it's a restrictive role
            let foundDisableInOtherChannel = false;
            for (const otherChannel of otherVoiceChannels.values()) {
              const otherChannelOverrides =
                otherChannel.permissionOverwrites.cache.get(role.id);
              const otherChannelAllows = otherChannelOverrides
                ? otherChannelOverrides.allow.has("Connect")
                : false;

              // If other channel doesn't have override allowing Connect, check permissions
              if (!otherChannelAllows) {
                const otherChannelPerms = otherChannel.permissionsFor(role);
                const otherCanConnect =
                  otherChannelPerms?.has("Connect") ?? true;
                if (!otherCanConnect) {
                  foundDisableInOtherChannel = true;
                  logger.debug(
                    `Role ${role.name} has Connect disabled in channel ${otherChannel.name}, treating as restrictive`,
                  );
                  break;
                }
              }
            }

            // If we found the role has Connect disabled in another channel, treat it as restrictive
            // This means the role has Connect disabled at the role level, even if this channel's
            // @everyone override or other factors allow Connect
            if (foundDisableInOtherChannel) {
              roleHasConnectDisabled = true;
            }
          }

          logger.debug(
            `Checking role ${role.name} for user ${member.user.tag} in channel ${channel.name}: effectiveCanConnect=${roleCanConnectEffective}, hasOverride=${hasChannelOverride}, overrideAllows=${channelOverrideAllowsConnect}, overrideDenies=${channelOverrideDeniesConnect}, roleHasConnectDisabled=${roleHasConnectDisabled}`,
          );

          // If this role has Connect disabled at the role level,
          // AND there's no channel override explicitly allowing Connect,
          // treat it as a restrictive role
          // Note: We disconnect users with restrictive roles regardless of other roles
          if (roleHasConnectDisabled && !channelOverrideAllowsConnect) {
            hasRestrictiveRole = true;
            restrictiveRoleName = role.name;
            logger.info(
              `User ${member.user.tag} has restrictive role ${role.name} (Connect disabled) in channel ${channel.name} - will disconnect`,
            );
            break; // Found a restrictive role, no need to check others
          }
        }

        // Also check overall permissions as a fallback
        // This catches cases where permissions are set at channel level
        const memberPermissions = channel.permissionsFor(member);
        const canConnectOverall = memberPermissions?.has("Connect") ?? true;

        logger.debug(
          `Permission check for ${member.user.tag} in channel ${channel.name}: hasRestrictiveRole=${hasRestrictiveRole}, canConnectOverall=${canConnectOverall}`,
        );

        // Disconnect if user has a restrictive role OR can't connect overall
        // ONLY disconnect for Connect restrictions - never mute as fallback
        if (hasRestrictiveRole || !canConnectOverall) {
          // User has a restrictive role that prevents voice channel access
          const reason = hasRestrictiveRole
            ? `Restrictive role "${restrictiveRoleName}": Connect disabled - voice channel access denied`
            : "Connect disabled - voice channel access denied";

          if (hasMoveMembers) {
            try {
              await member.voice.disconnect(reason);
              logger.info(
                `🚫 Disconnected ${member.user.tag} from voice channel ${channel.name} ${hasRestrictiveRole ? `due to restrictive role "${restrictiveRoleName}" (Connect disabled)` : "due to restricted Connect permissions"}`,
              );
              return; // Don't track voice time for restricted users
            } catch (disconnectError) {
              logger.error(
                `❌ Failed to disconnect ${member.user.tag} from voice channel: ${disconnectError.message}. ` +
                  `Enable "Move Members" permission in Server Settings → Roles → [Bot's Role] → General Permissions.`,
              );
              return; // Still return - don't fall back to muting for Connect issues
            }
          } else {
            logger.error(
              `❌ Cannot disconnect ${member.user.tag} - bot missing MoveMembers permission. ` +
                `Enable "Move Members" permission in Server Settings → Roles → [Bot's Role] → General Permissions. ` +
                `Connect restrictions require disconnection, not muting.`,
            );
            return; // Don't track voice time for restricted users
          }
        }

        // Also check for Speak restrictions when user joins/switches
        // If user has a role with Speak disabled, mute them immediately
        if (hasMuteMembers) {
          let hasRestrictiveSpeakRole = false;
          let restrictiveSpeakRoleName = null;

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
                `User ${member.user.tag} has role ${role.name} with Speak disabled in channel ${channel.name}`,
              );
              break;
            }
          }

          // If user has a restrictive Speak role, mute them
          if (hasRestrictiveSpeakRole) {
            logger.debug(
              `Speak restriction check for ${member.user.tag}: hasRestrictiveSpeakRole=${hasRestrictiveSpeakRole}, voice.mute=${member.voice.mute}, voice.selfMute=${member.voice.selfMute}`,
            );
            if (!member.voice.mute && !member.voice.selfMute) {
              try {
                await member.voice.setMute(
                  true,
                  `Restrictive role "${restrictiveSpeakRoleName}": Speak permission denied`,
                );
                logger.info(
                  `🔇 Muted ${member.user.tag} in voice channel ${channel.name} due to restrictive role "${restrictiveSpeakRoleName}" (Speak disabled)`,
                );
              } catch (muteError) {
                logger.warn(
                  `Failed to mute ${member.user.tag} in voice channel:`,
                  muteError.message,
                );
              }
            } else {
              logger.debug(
                `Skipping mute for ${member.user.tag} - already muted (voice.mute=${member.voice.mute}, voice.selfMute=${member.voice.selfMute})`,
              );
            }
          }
        } else {
          logger.debug(
            `Bot missing MuteMembers permission - cannot enforce Speak restrictions for ${member.user.tag}`,
          );
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
