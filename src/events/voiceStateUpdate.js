import { getLogger } from "../utils/logger.js";
import { getVoiceTracker } from "../features/experience/VoiceTracker.js";

/**
 * Handle voice state updates for XP tracking
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
    if (!userId) return;

    // Allow dependency injection for testing
    const voiceTracker = options.voiceTracker
      ? await Promise.resolve(options.voiceTracker)
      : await getVoiceTracker();

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
