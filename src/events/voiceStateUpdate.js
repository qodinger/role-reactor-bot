import { PermissionFlagsBits } from "discord.js";
import { getLogger } from "../utils/logger.js";
import { getVoiceTracker } from "../features/experience/VoiceTracker.js";
import { getStorageManager } from "../utils/storage/storageManager.js";

/**
 * Handle voice state updates for XP tracking and voice disconnect roles
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
    const userId = newState.member?.id;
    if (!userId || !newState.member) return;

    // Allow dependency injection for testing
    const voiceTracker = options.voiceTracker
      ? await Promise.resolve(options.voiceTracker)
      : await getVoiceTracker();

    // User joined a voice channel
    if (!oldState.channelId && newState.channelId) {
      // Check if user has voice control roles
      try {
        const storageManager = await getStorageManager();
        const settings = await storageManager.getVoiceControlRoles(guildId);

        const botMember = newState.guild.members.me;

        // Check for disconnect roles
        if (
          settings.disconnectRoleIds &&
          settings.disconnectRoleIds.length > 0
        ) {
          const hasDisconnectRole = newState.member.roles.cache.some(role =>
            settings.disconnectRoleIds.includes(role.id),
          );

          if (hasDisconnectRole) {
            if (botMember?.permissions.has(PermissionFlagsBits.MoveMembers)) {
              try {
                await newState.member.voice.disconnect(
                  "Automatically disconnected due to disconnect role",
                );
                logger.info(
                  `🔌 Disconnected ${newState.member.user.tag} from voice channel - user has disconnect role`,
                );
                return; // Don't track voice activity if disconnected
              } catch (error) {
                logger.error(
                  `Failed to disconnect ${newState.member.user.tag} from voice channel:`,
                  error.message,
                );
              }
            } else {
              logger.warn(
                `Cannot disconnect ${newState.member.user.tag} - bot missing MoveMembers permission in ${newState.guild.name}`,
              );
            }
          }
        }

        // Check for mute roles
        if (settings.muteRoleIds && settings.muteRoleIds.length > 0) {
          const hasMuteRole = newState.member.roles.cache.some(role =>
            settings.muteRoleIds.includes(role.id),
          );

          if (hasMuteRole) {
            if (botMember?.permissions.has(PermissionFlagsBits.MuteMembers)) {
              try {
                await newState.member.voice.setMute(
                  true,
                  "Automatically muted due to mute role",
                );
                logger.info(
                  `🔇 Muted ${newState.member.user.tag} in voice channel - user has mute role`,
                );
              } catch (error) {
                logger.error(
                  `Failed to mute ${newState.member.user.tag} in voice channel:`,
                  error.message,
                );
              }
            } else {
              logger.warn(
                `Cannot mute ${newState.member.user.tag} - bot missing MuteMembers permission in ${newState.guild.name}`,
              );
            }
          }
        }
      } catch (error) {
        logger.error("Error checking voice control roles:", error);
      }

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
      // Check if user has voice control roles
      try {
        const storageManager = await getStorageManager();
        const settings = await storageManager.getVoiceControlRoles(guildId);

        const botMember = newState.guild.members.me;

        // Check for disconnect roles
        if (
          settings.disconnectRoleIds &&
          settings.disconnectRoleIds.length > 0
        ) {
          const hasDisconnectRole = newState.member.roles.cache.some(role =>
            settings.disconnectRoleIds.includes(role.id),
          );

          if (hasDisconnectRole) {
            if (botMember?.permissions.has(PermissionFlagsBits.MoveMembers)) {
              try {
                await newState.member.voice.disconnect(
                  "Automatically disconnected due to disconnect role",
                );
                logger.info(
                  `🔌 Disconnected ${newState.member.user.tag} from voice channel - user has disconnect role`,
                );
                // Stop tracking old channel
                await voiceTracker.stopVoiceTracking(guildId, userId);
                return; // Don't track new channel if disconnected
              } catch (error) {
                logger.error(
                  `Failed to disconnect ${newState.member.user.tag} from voice channel:`,
                  error.message,
                );
              }
            } else {
              logger.warn(
                `Cannot disconnect ${newState.member.user.tag} - bot missing MoveMembers permission in ${newState.guild.name}`,
              );
            }
          }
        }

        // Check for mute roles
        if (settings.muteRoleIds && settings.muteRoleIds.length > 0) {
          const hasMuteRole = newState.member.roles.cache.some(role =>
            settings.muteRoleIds.includes(role.id),
          );

          if (hasMuteRole) {
            if (botMember?.permissions.has(PermissionFlagsBits.MuteMembers)) {
              try {
                // Only mute if not already muted
                if (!newState.mute) {
                  await newState.member.voice.setMute(
                    true,
                    "Automatically muted due to mute role",
                  );
                  logger.info(
                    `🔇 Muted ${newState.member.user.tag} in voice channel - user has mute role`,
                  );
                } else {
                  logger.debug(
                    `User ${newState.member.user.tag} already muted, skipping mute action`,
                  );
                }
              } catch (error) {
                logger.error(
                  `Failed to mute ${newState.member.user.tag} in voice channel:`,
                  error.message,
                );
              }
            } else {
              logger.warn(
                `Cannot mute ${newState.member.user.tag} - bot missing MuteMembers permission in ${newState.guild.name}`,
              );
            }
          }
        }

        // Check for deafen roles
        if (settings.deafenRoleIds && settings.deafenRoleIds.length > 0) {
          const hasDeafenRole = newState.member.roles.cache.some(role =>
            settings.deafenRoleIds.includes(role.id),
          );

          if (hasDeafenRole) {
            if (botMember?.permissions.has(PermissionFlagsBits.DeafenMembers)) {
              try {
                // Only deafen if not already deafened
                if (!newState.deaf) {
                  await newState.member.voice.setDeaf(
                    true,
                    "Automatically deafened due to deafen role",
                  );
                  logger.info(
                    `🔊 Deafened ${newState.member.user.tag} in voice channel - user has deafen role`,
                  );
                } else {
                  logger.debug(
                    `User ${newState.member.user.tag} already deafened, skipping deafen action`,
                  );
                }
              } catch (error) {
                logger.error(
                  `Failed to deafen ${newState.member.user.tag} in voice channel:`,
                  error.message,
                );
              }
            } else {
              logger.warn(
                `Cannot deafen ${newState.member.user.tag} - bot missing DeafenMembers permission in ${newState.guild.name}`,
              );
            }
          }
        }

        // Check for move roles
        if (
          settings.moveRoleMappings &&
          Object.keys(settings.moveRoleMappings).length > 0
        ) {
          const moveRole = newState.member.roles.cache.find(
            role => settings.moveRoleMappings[role.id],
          );

          if (moveRole) {
            const targetChannelId = settings.moveRoleMappings[moveRole.id];
            const targetChannel =
              newState.guild.channels.cache.get(targetChannelId);

            if (!targetChannel) {
              logger.warn(
                `Cannot move ${newState.member.user.tag} - target channel ${targetChannelId} not found (may have been deleted)`,
              );
              // Continue to voice tracking - user is still in newState.channelId
            } else {
              // Check if user is already in the target channel
              if (newState.channelId === targetChannelId) {
                logger.debug(
                  `User ${newState.member.user.tag} already in target channel ${targetChannel.name}, skipping move`,
                );
                // Continue to voice tracking - user is already in correct channel
              } else if (
                botMember?.permissions.has(PermissionFlagsBits.MoveMembers)
              ) {
                // Check bot permissions for the target channel
                const botPermissions = targetChannel.permissionsFor(botMember);
                if (
                  !botPermissions?.has("Connect") ||
                  !botPermissions?.has("MoveMembers")
                ) {
                  logger.warn(
                    `Cannot move ${newState.member.user.tag} to ${targetChannel.name} - bot missing permissions in target channel`,
                  );
                  // Continue to voice tracking - user is still in newState.channelId
                } else {
                  try {
                    await newState.member.voice.setChannel(
                      targetChannel,
                      "Automatically moved due to move role",
                    );
                    logger.info(
                      `🚚 Moved ${newState.member.user.tag} to ${targetChannel.name} - user has move role`,
                    );
                    // Update tracking to new channel
                    await voiceTracker.stopVoiceTracking(guildId, userId);
                    await voiceTracker.startVoiceTracking(
                      guildId,
                      userId,
                      targetChannelId,
                    );
                    return; // Don't track original channel - already tracked target channel
                  } catch (error) {
                    logger.error(
                      `Failed to move ${newState.member.user.tag} to voice channel:`,
                      error.message,
                    );
                    // Continue to voice tracking - user is still in newState.channelId
                  }
                }
              } else {
                logger.warn(
                  `Cannot move ${newState.member.user.tag} - bot missing MoveMembers permission in ${newState.guild.name}`,
                );
                // Continue to voice tracking - user is still in newState.channelId
              }
            }
          }
        }
      } catch (error) {
        logger.error("Error checking voice control roles:", error);
      }

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
