import { getLogger } from "../utils/logger.js";
import { getVoiceTracker } from "../features/experience/VoiceTracker.js";
import { getVoiceOperationQueue } from "../utils/discord/voiceOperationQueue.js";
import {
  checkConnectRestriction,
  checkSpeakRestriction,
  enforceVoiceRestrictions,
} from "../utils/discord/voiceRestrictions.js";

// Track bot-initiated mute actions to prevent infinite loops
// Format: `${guildId}:${userId}:${timestamp}` -> expires after 5 seconds
const botActionCache = new Set();
const BOT_ACTION_EXPIRY = 5000; // 5 seconds

// Clean up expired entries every 10 seconds
setInterval(() => {
  const now = Date.now();
  const entriesToRemove = [];
  for (const entry of botActionCache) {
    const parts = entry.split(":");
    if (parts.length === 3) {
      const timestamp = parseInt(parts[2], 10);
      if (now - timestamp > BOT_ACTION_EXPIRY) {
        entriesToRemove.push(entry);
      }
    }
  }
  entriesToRemove.forEach(entry => botActionCache.delete(entry));
}, 10000);

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

    // Check if this is a bot-initiated action (prevent infinite loops)
    const muteStatusChanged = oldState.mute !== newState.mute;
    if (muteStatusChanged) {
      const now = Date.now();

      // Check if this change was caused by the bot (within last 5 seconds)
      let isBotAction = false;
      for (const entry of botActionCache) {
        const parts = entry.split(":");
        if (parts.length === 3) {
          const entryGuildId = parts[0];
          const entryUserId = parts[1];
          const entryTimestamp = parseInt(parts[2], 10);

          if (entryGuildId === guildId && entryUserId === userId) {
            const timeDiff = now - entryTimestamp;
            if (timeDiff >= 0 && timeDiff < BOT_ACTION_EXPIRY) {
              isBotAction = true;
              logger.debug(
                `Detected bot-initiated action for ${member.user.tag} (${timeDiff}ms ago) - skipping to prevent loop`,
              );
              break;
            }
          }
        }
      }

      if (isBotAction) {
        logger.debug(
          `Skipping voiceStateUpdate for ${member.user.tag} - this is a bot-initiated action (preventing loop)`,
        );
        return;
      }
    }
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

        // Use global queue for voice operations
        const voiceQueue = getVoiceOperationQueue();

        // Queue voice operation - queue will handle enforcement and logging
        voiceQueue
          .queueOperation({
            member,
            reason: "Voice state update - checking unmute",
            type: "enforce",
          })
          .catch(error => {
            logger.debug(
              `Failed to queue voice operation for ${member.user.tag}:`,
              error.message,
            );
          });
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

        // Check both Connect and Speak restrictions
        const hasMoveMembers =
          botMember?.permissions.has("MoveMembers") ?? false;

        // Refresh member to ensure we have latest roles
        try {
          await member.fetch();
        } catch (error) {
          logger.debug(
            `Failed to refresh member ${member.user.tag}:`,
            error.message,
          );
        }

        // Check for restrictive Connect role (highest priority - disconnect)
        const {
          hasRestrictiveRole: hasConnectRestriction,
          roleName: connectRoleName,
        } = checkConnectRestriction(member, channel);

        // Check for restrictive Speak role (mute)
        const { hasRestrictiveSpeakRole, roleName: restrictiveSpeakRoleName } =
          checkSpeakRestriction(member, channel);

        // Priority 1: If user has restrictive Connect role, disconnect immediately
        // IMPORTANT: Always try immediate enforcement first, even if we think we're rate limited
        // The rate limit might have expired by the time we try, or Discord might allow it
        if (hasConnectRestriction && hasMoveMembers) {
          // OPTIMIZATION: Skip if user is already disconnected (not in voice channel)
          if (member.voice.channel) {
            let immediateDisconnectSucceeded = false;

            // Try immediate disconnect regardless of rate limit check
            // This gives us the best chance of immediate enforcement
            try {
              // Track this as a bot-initiated action to prevent infinite loops
              const now = Date.now();
              const actionKey = `${guildId}:${userId}:${now}`;
              botActionCache.add(actionKey);

              await member.voice.disconnect(
                `Restrictive role "${connectRoleName}": Connect permission denied`,
              );
              logger.info(
                `🚫 Immediately disconnected ${member.user.tag} from voice channel ${channel.name} due to restrictive role "${connectRoleName}" (Connect disabled)`,
              );
              immediateDisconnectSucceeded = true;
            } catch (error) {
              // Error during immediate disconnect, fall through to queue
              // Check if it's a rate limit error
              if (error.message?.includes("rate limit") || error.code === 429) {
                logger.debug(
                  `Rate limited during immediate disconnect for ${member.user.tag}, queuing operation`,
                );
              } else {
                logger.debug(
                  `Error during immediate disconnect for ${member.user.tag}: ${error.message}, queuing operation`,
                );
              }
            }

            // Only queue if immediate disconnect didn't succeed or wasn't attempted
            if (!immediateDisconnectSucceeded) {
              // Track this as a bot-initiated action to prevent infinite loops
              const now = Date.now();
              const actionKey = `${guildId}:${userId}:${now}`;
              botActionCache.add(actionKey);

              // Use global queue for disconnecting
              const voiceQueue = getVoiceOperationQueue();

              // Find the restrictive role
              const restrictiveRole = member.roles.cache.find(role => {
                const rolePermissions = channel.permissionsFor(role);
                const canConnect = rolePermissions?.has("Connect") ?? true;
                const channelOverrides = channel.permissionOverwrites.cache.get(
                  role.id,
                );
                const overrideAllowsConnect = channelOverrides
                  ? channelOverrides.allow.has("Connect")
                  : false;
                const overrideDeniesConnect = channelOverrides
                  ? channelOverrides.deny.has("Connect")
                  : false;
                return (
                  (!canConnect || overrideDeniesConnect) &&
                  !overrideAllowsConnect
                );
              });

              voiceQueue
                .queueOperation({
                  member,
                  role: restrictiveRole || { name: connectRoleName },
                  reason: `Restrictive role "${connectRoleName}": Connect permission denied`,
                  type: "enforce",
                })
                .catch(error => {
                  logger.debug(
                    `Failed to queue disconnect operation for ${member.user.tag}:`,
                    error.message,
                  );
                });
            }
          } else {
            // User already disconnected - no action needed
            logger.debug(
              `User ${member.user.tag} already disconnected - no action needed`,
            );
          }
        }
        // Priority 2: If user has restrictive Speak role (and no Connect restriction), mute immediately
        // IMPORTANT: Always try immediate enforcement first, even if we think we're rate limited
        // The rate limit might have expired by the time we try, or Discord might allow it
        else if (hasRestrictiveSpeakRole && hasMuteMembers) {
          // OPTIMIZATION: Skip if user is already muted
          if (member.voice.mute && !member.voice.selfMute) {
            logger.debug(
              `User ${member.user.tag} already muted - no action needed`,
            );
            // User already muted - no action needed
          } else {
            let immediateMuteSucceeded = false;

            // Try immediate mute regardless of rate limit check
            // This gives us the best chance of immediate enforcement
            try {
              // Track this as a bot-initiated action to prevent infinite loops
              const now = Date.now();
              const actionKey = `${guildId}:${userId}:${now}`;
              botActionCache.add(actionKey);

              // Only mute if not already muted
              if (!member.voice.mute && !member.voice.selfMute) {
                await member.voice.setMute(
                  true,
                  `Restrictive role "${restrictiveSpeakRoleName}": Speak permission denied`,
                );
                logger.info(
                  `🔇 Immediately muted ${member.user.tag} in voice channel ${channel.name} due to restrictive role "${restrictiveSpeakRoleName}" (Speak disabled)`,
                );
                immediateMuteSucceeded = true;
              } else {
                // Already muted - no action needed
                logger.debug(
                  `User ${member.user.tag} already muted - no action needed`,
                );
                immediateMuteSucceeded = true; // Consider it successful since they're already muted
              }
            } catch (error) {
              // Error during immediate mute, fall through to queue
              // Check if it's a rate limit error
              if (error.message?.includes("rate limit") || error.code === 429) {
                logger.debug(
                  `Rate limited during immediate mute for ${member.user.tag}, queuing operation`,
                );
              } else {
                logger.debug(
                  `Error during immediate mute for ${member.user.tag}: ${error.message}, queuing operation`,
                );
              }
            }

            // Only queue if immediate mute didn't succeed or wasn't attempted
            if (!immediateMuteSucceeded) {
              // Track this as a bot-initiated action to prevent infinite loops
              const now = Date.now();
              const actionKey = `${guildId}:${userId}:${now}`;
              botActionCache.add(actionKey);

              // Use global queue for muting
              const voiceQueue = getVoiceOperationQueue();

              // Find the restrictive role
              const restrictiveRole = member.roles.cache.find(role => {
                const rolePermissions = channel.permissionsFor(role);
                const canSpeak = rolePermissions?.has("Speak") ?? true;
                const channelOverrides = channel.permissionOverwrites.cache.get(
                  role.id,
                );
                const overrideAllowsSpeak = channelOverrides
                  ? channelOverrides.allow.has("Speak")
                  : false;
                const overrideDeniesSpeak = channelOverrides
                  ? channelOverrides.deny.has("Speak")
                  : false;
                return (
                  (!canSpeak || overrideDeniesSpeak) && !overrideAllowsSpeak
                );
              });

              voiceQueue
                .queueOperation({
                  member,
                  role: restrictiveRole || { name: restrictiveSpeakRoleName },
                  reason: `Restrictive role "${restrictiveSpeakRoleName}": Speak permission denied`,
                  type: "mute",
                  forceMute: true,
                })
                .catch(error => {
                  logger.debug(
                    `Failed to queue mute operation for ${member.user.tag}:`,
                    error.message,
                  );
                });
            }
          }
        } else {
          // User doesn't have restrictive role OR bot missing permissions
          if (!hasConnectRestriction && !hasRestrictiveSpeakRole) {
            // User doesn't have restrictive role - queue unmute operation
            logger.debug(
              `User ${member.user.tag} tried to unmute and has no restrictive roles - queuing unmute`,
            );

            // Use global queue for unmuting
            const voiceQueue = getVoiceOperationQueue();

            voiceQueue
              .queueOperation({
                member,
                reason: "User tried to unmute - checking restrictions",
                type: "enforce",
              })
              .catch(error => {
                logger.debug(
                  `Failed to queue unmute operation for ${member.user.tag}:`,
                  error.message,
                );
              });
          } else {
            // Bot missing required permissions
            if (hasConnectRestriction && !hasMoveMembers) {
              logger.debug(
                `Bot missing MoveMembers permission - cannot disconnect ${member.user.tag}`,
              );
            } else if (hasRestrictiveSpeakRole && !hasMuteMembers) {
              logger.debug(
                `Bot missing MuteMembers permission - cannot mute ${member.user.tag}`,
              );
            }
          }
        }
      }
    }

    // Check if user joined a voice channel (new connection or switched channels)
    // This prevents users with restrictive roles from joining voice channels
    // IMPORTANT: Check and enforce immediately when user joins, don't wait for queue
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

        // Check restrictions immediately before queuing
        const { hasRestrictiveRole: hasConnectRestriction } =
          checkConnectRestriction(member, channel);
        const { hasRestrictiveSpeakRole } = checkSpeakRestriction(
          member,
          channel,
        );

        const reason = justJoined
          ? "User joined voice channel"
          : "User switched voice channels";

        // If user has restrictive roles, try to enforce immediately
        // IMPORTANT: Always try immediate enforcement first, even if we think we're rate limited
        // The rate limit might have expired by the time we try, or Discord might allow it
        if (hasConnectRestriction || hasRestrictiveSpeakRole) {
          // OPTIMIZATION: Check if user is already in correct state before trying enforcement
          // This reduces unnecessary operations and rate limit checks
          const alreadyInCorrectState =
            (hasConnectRestriction && !member.voice.channel) ||
            (hasRestrictiveSpeakRole &&
              member.voice.mute &&
              !member.voice.selfMute);

          if (alreadyInCorrectState) {
            logger.debug(
              `User ${member.user.tag} already in correct state - no enforcement needed`,
            );
            // No need to queue or enforce - user is already muted/disconnected
            // Skip to voice tracking below
          } else {
            let immediateEnforcementSucceeded = false;

            // Try immediate enforcement regardless of rate limit check
            // This gives us the best chance of immediate enforcement
            try {
              const result = await enforceVoiceRestrictions(member, reason);

              if (result.disconnected || result.muted) {
                // Successfully enforced immediately - track in botActionCache to prevent loops
                const now = Date.now();
                const actionKey = `${guildId}:${userId}:${now}`;
                botActionCache.add(actionKey);

                // Successfully enforced immediately - no need to queue
                logger.debug(
                  `✅ Immediately enforced voice restrictions for ${member.user.tag} on join (${result.disconnected ? "disconnected" : "muted"})`,
                );
                immediateEnforcementSucceeded = true;
                // Continue to voice tracking below, but don't queue operation
                // (The restriction is already applied)
              } else if (result.error && result.needsWait) {
                // Rate limited during enforcement, fall through to queue
                logger.debug(
                  `Rate limited during immediate enforcement for ${member.user.tag}, queuing operation`,
                );
              } else if (result.error) {
                // Other error, fall through to queue
                logger.debug(
                  `Error during immediate enforcement for ${member.user.tag}: ${result.error}, queuing operation`,
                );
              } else {
                // No action needed (user doesn't need restrictions)
                logger.debug(
                  `No restrictions needed for ${member.user.tag} on join`,
                );
                immediateEnforcementSucceeded = true; // No need to queue
              }
            } catch (error) {
              // Error during immediate enforcement, fall through to queue
              // Check if it's a rate limit error
              if (error.message?.includes("rate limit") || error.code === 429) {
                logger.debug(
                  `Rate limited during immediate enforcement for ${member.user.tag}, queuing operation`,
                );
              } else {
                logger.debug(
                  `Exception during immediate enforcement for ${member.user.tag}: ${error.message}, queuing operation`,
                );
              }
            }

            // Only queue if immediate enforcement didn't succeed or wasn't attempted
            if (!immediateEnforcementSucceeded) {
              const voiceQueue = getVoiceOperationQueue();

              voiceQueue
                .queueOperation({
                  member,
                  reason,
                  type: "enforce",
                })
                .catch(error => {
                  logger.debug(
                    `Failed to queue voice operation for ${member.user.tag}:`,
                    error.message,
                  );
                });
            }
          }
        } else {
          // User has no restrictive roles - no action needed
          logger.debug(
            `User ${member.user.tag} joined voice channel with no restrictive roles`,
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
