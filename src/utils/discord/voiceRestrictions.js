import { getLogger } from "../logger.js";
import {
  isVoiceOperationRateLimited,
  getVoiceOperationRemainingTime,
} from "./rateLimiter.js";

const logger = getLogger();

/**
 * Centralized utility for checking and enforcing voice restrictions based on roles
 * This works for any role assignment method (commands, scheduled, reactions, etc.)
 */

/**
 * Check if a role has Connect disabled in a voice channel
 * @param {import("discord.js").Role} role - The role to check
 * @param {import("discord.js").VoiceBasedChannel} channel - The voice channel
 * @returns {boolean} True if the role has Connect disabled
 */
export function roleHasConnectDisabled(role, channel) {
  const rolePermissions = channel.permissionsFor(role);
  const canConnect = rolePermissions?.has("Connect") ?? true;

  const channelOverrides = channel.permissionOverwrites.cache.get(role.id);
  const overrideAllowsConnect = channelOverrides
    ? channelOverrides.allow.has("Connect")
    : false;
  const channelOverrideDeniesConnect = channelOverrides
    ? channelOverrides.deny.has("Connect")
    : false;

  // If override explicitly denies Connect, role has Connect disabled
  if (channelOverrideDeniesConnect) {
    return true;
  }

  // If override explicitly allows Connect, role does NOT have Connect disabled
  if (overrideAllowsConnect) {
    return false;
  }

  // Otherwise, check effective permissions
  return !canConnect;
}

/**
 * Check if a role has Speak disabled in a voice channel
 * @param {import("discord.js").Role} role - The role to check
 * @param {import("discord.js").VoiceBasedChannel} channel - The voice channel
 * @returns {boolean} True if the role has Speak disabled
 */
export function roleHasSpeakDisabled(role, channel) {
  const rolePermissions = channel.permissionsFor(role);
  const canSpeak = rolePermissions?.has("Speak") ?? true;

  const channelOverrides = channel.permissionOverwrites.cache.get(role.id);
  const overrideAllowsSpeak = channelOverrides
    ? channelOverrides.allow.has("Speak")
    : false;
  const overrideDeniesSpeak = channelOverrides
    ? channelOverrides.deny.has("Speak")
    : false;

  // If override explicitly denies Speak, role has Speak disabled
  if (overrideDeniesSpeak) {
    return true;
  }

  // If override explicitly allows Speak, role does NOT have Speak disabled
  if (overrideAllowsSpeak) {
    return false;
  }

  // Otherwise, check effective permissions
  return !canSpeak;
}

/**
 * Check if a member has any restrictive role (Connect disabled) in a voice channel
 * @param {import("discord.js").GuildMember} member - The member to check
 * @param {import("discord.js").VoiceBasedChannel} channel - The voice channel
 * @returns {{hasRestrictiveRole: boolean, roleName: string | null}} Result with role name
 */
export function checkConnectRestriction(member, channel) {
  for (const role of member.roles.cache.values()) {
    if (roleHasConnectDisabled(role, channel)) {
      return { hasRestrictiveRole: true, roleName: role.name };
    }
  }
  return { hasRestrictiveRole: false, roleName: null };
}

/**
 * Check if a member has any restrictive Speak role in a voice channel
 * @param {import("discord.js").GuildMember} member - The member to check
 * @param {import("discord.js").VoiceBasedChannel} channel - The voice channel
 * @returns {{hasRestrictiveSpeakRole: boolean, roleName: string | null}} Result with role name
 */
export function checkSpeakRestriction(member, channel) {
  for (const role of member.roles.cache.values()) {
    if (roleHasSpeakDisabled(role, channel)) {
      return { hasRestrictiveSpeakRole: true, roleName: role.name };
    }
  }
  return { hasRestrictiveSpeakRole: false, roleName: null };
}

/**
 * Enforce voice restrictions for a member in a voice channel
 * This handles both Connect (disconnect/mute) and Speak (mute) restrictions
 * @param {import("discord.js").GuildMember} member - The member to check
 * @param {string} reason - Reason for the restriction
 * @returns {Promise<{disconnected: boolean, muted: boolean, error?: string}>} Result of the operation
 */
export async function enforceVoiceRestrictions(
  member,
  reason = "Voice restriction",
) {
  // Check if member is in a voice channel
  if (!member.voice?.channel) {
    return { disconnected: false, muted: false };
  }

  // Refresh member to get latest voice state and roles
  // This is important when roles are removed - we need the latest state
  // Note: member.fetch() automatically updates the voice state, so we don't need to fetch it separately
  try {
    await member.fetch();
  } catch (error) {
    logger.debug(
      `Failed to refresh member ${member.user.tag} in enforceVoiceRestrictions:`,
      error.message,
    );
    // Continue with cached data if fetch fails
  }

  const channel = member.voice.channel;
  const guild = member.guild;
  const botMember = guild.members.me;

  if (!botMember) {
    logger.warn(
      `Cannot enforce voice restrictions for ${member.user.tag} - bot member not available`,
    );
    return {
      disconnected: false,
      muted: false,
      error: "Bot member not available",
    };
  }

  const hasMoveMembers = botMember.permissions.has("MoveMembers");
  const hasMuteMembers = botMember.permissions.has("MuteMembers");

  // Check Connect restrictions - ONLY disconnect, never mute for Connect issues
  const { hasRestrictiveRole, roleName } = checkConnectRestriction(
    member,
    channel,
  );
  if (hasRestrictiveRole) {
    if (hasMoveMembers) {
      // Check rate limit before disconnecting
      if (await isVoiceOperationRateLimited(member.id, guild.id)) {
        const remainingTime = getVoiceOperationRemainingTime(
          member.id,
          guild.id,
        );
        logger.warn(
          `⏸️ Rate limited: Cannot disconnect ${member.user.tag} - too many voice operations. Retry after ${Math.ceil(remainingTime / 1000)}s`,
        );
        return {
          disconnected: false,
          muted: false,
          error: "Rate limited",
          needsWait: true,
        };
      }

      try {
        await member.voice.disconnect(
          `${reason}: Restrictive role "${roleName}" - Connect disabled`,
        );
        logger.info(
          `🚫 Disconnected ${member.user.tag} from voice channel ${channel.name} due to restrictive role "${roleName}" (Connect disabled)`,
        );
        return { disconnected: true, muted: false };
      } catch (disconnectError) {
        // Check if it's a rate limit error
        if (
          disconnectError.message?.includes("rate limit") ||
          disconnectError.code === 429
        ) {
          logger.warn(
            `🚫 Discord rate limit hit while disconnecting ${member.user.tag}. Will retry after cooldown.`,
          );
        }
        logger.error(
          `❌ Failed to disconnect ${member.user.tag} from voice channel: ${disconnectError.message}. ` +
            `Enable "Move Members" permission in Server Settings → Roles → [Bot's Role] → General Permissions.`,
        );
        return {
          disconnected: false,
          muted: false,
          error: disconnectError.message,
        };
      }
    } else {
      logger.error(
        `❌ Cannot disconnect ${member.user.tag} - bot missing MoveMembers permission. ` +
          `Enable "Move Members" permission in Server Settings → Roles → [Bot's Role] → General Permissions. ` +
          `Connect restrictions require disconnection, not muting.`,
      );
      return {
        disconnected: false,
        muted: false,
        error: "Missing MoveMembers permission",
        needsPermission: true,
      };
    }
  }

  // Check Speak restrictions FIRST before checking if user should be unmuted
  // This ensures we check current state accurately
  const { hasRestrictiveSpeakRole, roleName: speakRoleName } =
    checkSpeakRestriction(member, channel);

  logger.debug(
    `Speak restriction check for ${member.user.tag} in ${channel.name}: hasRestrictiveSpeakRole=${hasRestrictiveSpeakRole}, roleName=${speakRoleName || "none"}`,
  );

  if (hasRestrictiveSpeakRole) {
    if (hasMuteMembers) {
      // Only mute if not already muted
      // OPTIMIZATION: Skip rate limit check if already muted - saves an API call
      if (!member.voice.mute && !member.voice.selfMute) {
        // Check rate limit before muting
        if (await isVoiceOperationRateLimited(member.id, guild.id)) {
          const remainingTime = getVoiceOperationRemainingTime(
            member.id,
            guild.id,
          );
          logger.warn(
            `⏸️ Rate limited: Cannot mute ${member.user.tag} - too many voice operations. Retry after ${Math.ceil(remainingTime / 1000)}s`,
          );
          return {
            disconnected: false,
            muted: false,
            error: "Rate limited",
            needsWait: true,
          };
        }

        try {
          await member.voice.setMute(
            true,
            `${reason}: Restrictive role "${speakRoleName}" - Speak disabled`,
          );
          logger.info(
            `🔇 Muted ${member.user.tag} in voice channel ${channel.name} due to restrictive role "${speakRoleName}" (Speak disabled)`,
          );
          return { disconnected: false, muted: true };
        } catch (muteError) {
          // Check if it's a rate limit error
          if (
            muteError.message?.includes("rate limit") ||
            muteError.code === 429
          ) {
            logger.warn(
              `🚫 Discord rate limit hit while muting ${member.user.tag}. Will retry after cooldown.`,
            );
          } else {
            logger.warn(
              `Failed to mute ${member.user.tag} in voice channel:`,
              muteError.message,
            );
          }
          return {
            disconnected: false,
            muted: false,
            error: muteError.message,
          };
        }
      } else {
        // OPTIMIZATION: User already muted - return success without any operations
        logger.debug(
          `User ${member.user.tag} already muted (voice.mute=${member.voice.mute}, voice.selfMute=${member.voice.selfMute}) - keeping muted due to restrictive role`,
        );
        return { disconnected: false, muted: true }; // Return success since they're already muted
      }
    } else {
      logger.error(
        `❌ Cannot mute ${member.user.tag} - bot missing MuteMembers permission. ` +
          `Enable "Mute Members" permission in Server Settings → Roles → [Bot's Role] → General Permissions. ` +
          `Speak restrictions require muting, not disconnecting.`,
      );
      return {
        disconnected: false,
        muted: false,
        error: "Missing MuteMembers permission",
        needsPermission: true,
      };
    }
  }

  // If no restrictions, check if user should be unmuted (removed restrictive role)
  // IMPORTANT: Always check if user should be unmuted, even if they're not currently muted
  // This handles cases where users joined voice with a restrictive role but weren't muted
  // due to rate limits or timing issues
  logger.debug(
    `Unmute check for ${member.user.tag}: voice.mute=${member.voice.mute}, voice.selfMute=${member.voice.selfMute}, hasRestrictiveSpeakRole=${hasRestrictiveSpeakRole}, hasMuteMembers=${hasMuteMembers}, channel=${channel.name}`,
  );

  // If user has no restrictive role and bot has permission, ensure they're not muted
  // This handles both cases:
  // 1. User was muted by bot and role was removed -> unmute them
  // 2. User joined voice with restrictive role but wasn't muted -> ensure they're not muted
  if (!hasRestrictiveSpeakRole && hasMuteMembers) {
    // Only attempt unmute if user is muted and not self-muted
    // If user is not muted, they're already in the correct state
    // IMPORTANT: Check if member is server-muted (regardless of self-mute status)
    // A member can be both server-muted (by bot) and self-muted (by themselves)
    // We should remove the server mute if they no longer have restrictive roles,
    // even if they're also self-muted
    if (member.voice.mute) {
      // Check rate limit before unmuting
      if (await isVoiceOperationRateLimited(member.id, guild.id)) {
        const remainingTime = getVoiceOperationRemainingTime(
          member.id,
          guild.id,
        );
        logger.warn(
          `⏸️ Rate limited: Cannot unmute ${member.user.tag} - too many voice operations. Retry after ${Math.ceil(remainingTime / 1000)}s`,
        );
        return {
          disconnected: false,
          muted: false,
          error: "Rate limited",
          needsWait: true,
        };
      }

      logger.debug(
        `All conditions met for unmute - attempting to unmute ${member.user.tag} (server-muted, selfMute: ${member.voice.selfMute})`,
      );
      try {
        await member.voice.setMute(
          false,
          `${reason}: Restrictive Speak role removed`,
        );
        logger.info(
          `🔊 Unmuted ${member.user.tag} in voice channel ${channel.name} - no longer has restrictive Speak role (was server-muted, selfMute: ${member.voice.selfMute})`,
        );
        return { disconnected: false, muted: false, unmuted: true };
      } catch (unmuteError) {
        // Check if it's a rate limit error
        if (
          unmuteError.message?.includes("rate limit") ||
          unmuteError.code === 429
        ) {
          logger.warn(
            `🚫 Discord rate limit hit while unmuting ${member.user.tag}. Will retry after cooldown.`,
          );
          return {
            disconnected: false,
            muted: false,
            error: "Rate limited",
            needsWait: true,
          };
        } else {
          logger.warn(
            `Failed to unmute ${member.user.tag} in voice channel:`,
            unmuteError.message,
          );
        }
        return {
          disconnected: false,
          muted: false,
          error: unmuteError.message,
        };
      }
    } else {
      // User is not server-muted and has no restrictive role - this is the correct state
      logger.debug(
        `User ${member.user.tag} is not server-muted and has no restrictive role - correct state`,
      );
      return { disconnected: false, muted: false, unmuted: false };
    }
  } else {
    // Log why unmute wasn't attempted
    if (hasRestrictiveSpeakRole) {
      logger.debug(
        `Not unmuting ${member.user.tag} - user still has restrictive Speak role`,
      );
    } else if (!hasMuteMembers) {
      logger.warn(
        `❌ Cannot unmute ${member.user.tag} - bot missing MuteMembers permission. ` +
          `Enable "Mute Members" permission in Server Settings → Roles → [Bot's Role] → General Permissions to allow the bot to unmute users.`,
      );
      return {
        disconnected: false,
        muted: false,
        error: "Bot missing MuteMembers permission",
        needsPermission: true,
      };
    }
  }

  return { disconnected: false, muted: false };
}
