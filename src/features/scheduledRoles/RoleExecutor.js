import { getLogger } from "../../utils/logger.js";
import { delay } from "../../utils/delay.js";
import {
  bulkAddRoles,
  bulkRemoveRoles,
  getCachedMember,
} from "../../utils/discord/roleManager.js";

/**
 * Role executor for large-scale operations
 * Handles rate limiting, batching, and error recovery for large servers
 */
export class RoleExecutor {
  constructor() {
    this.logger = getLogger();
    this.batchSize = 10; // Smaller batches for better rate limit handling
    this.batchDelay = 150; // 150ms delay between batches
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second initial retry delay
    this.rateLimitBackoff = 5000; // 5 seconds for rate limit backoff
  }

  /**
   * Execute role assignment/removal for large user lists with optimization
   * @param {import("discord.js").Guild} guild - The guild
   * @param {Array<string>} userIds - Array of user IDs
   * @param {import("discord.js").Role} role - The role to assign/remove
   * @param {string} action - "assign" or "remove"
   * @param {string} reason - Reason for the operation
   * @returns {Promise<Object>} Execution results with statistics
   */
  async executeRoleOperation(
    guild,
    userIds,
    role,
    action,
    reason = "Scheduled role operation",
  ) {
    const totalUsers = userIds.length;

    this.logger.info(
      `Starting optimized ${action} operation for ${totalUsers} users in guild ${guild.name}`,
    );

    // For very large operations (>1000 users), process in chunks
    if (totalUsers > 1000) {
      return this.executeLargeOperation(guild, userIds, role, action, reason);
    }

    // For smaller operations, use standard batch processing
    return this.executeBatchOperation(guild, userIds, role, action, reason);
  }

  /**
   * Execute large operations in chunks to avoid memory/rate limit issues
   */
  async executeLargeOperation(guild, userIds, role, action, reason) {
    const chunkSize = 500; // Process 500 users at a time
    const totalChunks = Math.ceil(userIds.length / chunkSize);
    const totalUsers = userIds.length;
    let totalSuccess = 0;
    let totalFailed = 0;
    const errors = [];

    this.logger.info(
      `Large operation detected: Processing ${totalUsers} users in ${totalChunks} chunks`,
    );

    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      const chunkNumber = Math.floor(i / chunkSize) + 1;

      this.logger.info(
        `Processing chunk ${chunkNumber}/${totalChunks} (${chunk.length} users)`,
      );

      try {
        const result = await this.executeBatchOperation(
          guild,
          chunk,
          role,
          action,
          reason,
        );

        totalSuccess += result.successCount;
        totalFailed += result.failedCount;
        errors.push(...result.errors);

        // Longer delay between chunks for very large operations
        if (i + chunkSize < userIds.length) {
          const delayMs = Math.min(2000, 500 + chunk.length * 2); // Adaptive delay
          await delay(delayMs);
        }
      } catch (error) {
        this.logger.error(`Error processing chunk ${chunkNumber}:`, error);
        totalFailed += chunk.length;
        errors.push({
          chunk: chunkNumber,
          error: error.message,
          userCount: chunk.length,
        });

        // Longer backoff on chunk errors
        await delay(this.rateLimitBackoff);
      }
    }

    return {
      successCount: totalSuccess,
      failedCount: totalFailed,
      totalUsers: userIds.length,
      errors,
      processed: totalSuccess + totalFailed,
    };
  }

  /**
   * Execute batch operation with rate limiting
   */
  async executeBatchOperation(guild, userIds, role, action, reason) {
    // Prepare operations in batches
    const operations = [];
    let processed = 0;

    // Fetch members in smaller batches to avoid overwhelming the API
    const fetchBatchSize = 20;
    for (let i = 0; i < userIds.length; i += fetchBatchSize) {
      const fetchBatch = userIds.slice(i, i + fetchBatchSize);

      // Fetch members with caching
      const memberPromises = fetchBatch.map(async userId => {
        try {
          const member = await getCachedMember(guild, userId);
          if (!member) {
            return null;
          }

          // Check if operation is needed
          if (action === "assign") {
            if (!member.roles.cache.has(role.id)) {
              return { member, role, action: "add" };
            }
          } else if (action === "remove") {
            if (member.roles.cache.has(role.id)) {
              return { member, role, action: "remove" };
            }
          }

          return null; // Already has/doesn't have role
        } catch (error) {
          this.logger.debug(
            `Failed to fetch/prepare member ${userId}:`,
            error.message,
          );
          return null;
        }
      });

      const batchOperations = await Promise.allSettled(memberPromises);
      for (const result of batchOperations) {
        if (result.status === "fulfilled" && result.value) {
          operations.push(result.value);
        }
      }

      processed += fetchBatch.length;

      // Small delay between fetch batches
      if (i + fetchBatchSize < userIds.length) {
        await delay(100);
      }

      // Log progress every 100 users
      if (processed % 100 === 0) {
        this.logger.debug(
          `Prepared ${processed}/${userIds.length} users, ${operations.length} operations needed`,
        );
      }
    }

    if (operations.length === 0) {
      this.logger.info(
        "No operations needed - all users already have/do not have the role",
      );
      return {
        successCount: 0,
        failedCount: 0,
        totalUsers: userIds.length,
        errors: [],
        processed: userIds.length,
      };
    }

    // Execute operations in optimized batches
    const addOperations = operations.filter(op => op.action === "add");
    const removeOperations = operations.filter(op => op.action === "remove");

    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    // Process add operations with retries
    if (addOperations.length > 0) {
      const addResults = await this.executeWithRetries(
        () =>
          bulkAddRoles(
            addOperations.map(op => ({ member: op.member, role: op.role })),
            reason,
          ),
        addOperations.length,
      );

      successCount += addResults.filter(r => r.success).length;
      failedCount += addResults.filter(r => !r.success).length;
      errors.push(
        ...addResults
          .filter(r => !r.success)
          .map(r => ({
            userId: r.memberId,
            error: r.error,
          })),
      );

      // Handle voice channel restrictions for users who were successfully assigned the role
      const voiceOperations = addOperations
        .filter(
          (op, idx) => addResults[idx]?.success && op.member.voice?.channel,
        )
        .map(op => ({ ...op, role })); // Include role for permission checking
      if (voiceOperations.length > 0) {
        await this.handleVoiceRestrictions(voiceOperations, reason);
      }
    }

    // Delay between add and remove operations
    if (addOperations.length > 0 && removeOperations.length > 0) {
      await delay(this.batchDelay * 2);
    }

    // Process remove operations with retries
    if (removeOperations.length > 0) {
      const removeResults = await this.executeWithRetries(
        () =>
          bulkRemoveRoles(
            removeOperations.map(op => ({ member: op.member, role: op.role })),
            reason,
          ),
        removeOperations.length,
      );

      successCount += removeResults.filter(r => r.success).length;
      failedCount += removeResults.filter(r => !r.success).length;
      errors.push(
        ...removeResults
          .filter(r => !r.success)
          .map(r => ({
            userId: r.memberId,
            error: r.error,
          })),
      );

      // Handle unmuting users when restrictive roles are removed
      // Check if the removed role had Speak disabled
      const voiceUnmuteOperations = removeOperations
        .filter(
          (op, idx) => removeResults[idx]?.success && op.member.voice?.channel,
        )
        .map(op => ({ ...op, role })); // Include role for permission checking
      if (voiceUnmuteOperations.length > 0) {
        await this.handleVoiceUnmute(voiceUnmuteOperations, reason);
      }
    }

    return {
      successCount,
      failedCount,
      totalUsers: userIds.length,
      errors: errors.slice(0, 100), // Limit error details to avoid memory issues
      processed: userIds.length,
    };
  }

  /**
   * Handle voice channel restrictions when assigning roles
   *
   * This function automatically disconnects or mutes users who are currently
   * in voice channels when a restrictive role is assigned.
   *
   * IMPORTANT: This handles users ALREADY in voice channels.
   * To prevent FUTURE voice channel joins, you must configure the role
   * permissions in Discord Server Settings (disable "Connect" permission).
   *
   * @param {Array} operations - Array of operations with member objects
   * @param {string} reason - Reason for the voice restriction
   */
  async handleVoiceRestrictions(operations, reason) {
    const logger = getLogger();

    if (operations.length === 0) {
      return;
    }

    // Get guild from first operation to check bot permissions once
    const guild = operations[0]?.member?.guild;
    if (!guild || !guild.members.me) {
      logger.warn(
        "Cannot check bot permissions for voice restrictions - guild or bot member not available",
      );
      return;
    }

    const botMember = guild.members.me;
    const hasMoveMembers = botMember.permissions.has("MoveMembers");
    const hasMuteMembers = botMember.permissions.has("MuteMembers");

    // Log permission status once at the start
    if (!hasMoveMembers && !hasMuteMembers) {
      logger.error(
        `❌ Missing required permissions for voice restrictions in ${guild.name}. ` +
          `Bot needs "Move Members" (to disconnect) or "Mute Members" (to mute) permissions at guild level. ` +
          `Configure in: Server Settings → Roles → [Bot's Role] → General Permissions`,
      );
      return;
    } else if (!hasMoveMembers) {
      logger.warn(
        `⚠️ Missing "Move Members" permission in ${guild.name}. Will attempt muting as fallback. ` +
          `For best results, enable "Move Members" in Server Settings → Roles → [Bot's Role] → General Permissions`,
      );
    }

    for (const operation of operations) {
      const { member, role } = operation;

      // Check if user is in a voice channel
      if (!member.voice?.channel) {
        continue;
      }

      // Refresh member to get updated role cache after role assignment
      try {
        await member.fetch();
      } catch (error) {
        logger.debug(
          `Failed to refresh member ${member.user.tag}:`,
          error.message,
        );
      }

      const channel = member.voice.channel;

      // Check if the restrictive role has Connect disabled - ONLY disconnect for Connect issues
      const roleCanConnect = role
        ? (channel.permissionsFor(role)?.has("Connect") ?? true)
        : true;

      // Check if the restrictive role has Speak disabled - ONLY mute for Speak issues
      const roleCanSpeak = role
        ? (channel.permissionsFor(role)?.has("Speak") ?? true)
        : true;

      // Handle Connect restriction - disconnect only
      if (!roleCanConnect) {
        if (hasMoveMembers) {
          try {
            await member.voice.disconnect(
              `Scheduled restriction: ${reason} - Role "${role.name}" has Connect disabled`,
            );
            logger.info(
              `🚫 Disconnected ${member.user.tag} from voice channel due to scheduled role "${role.name}" (Connect disabled)`,
            );
            continue; // Successfully disconnected, move to next user
          } catch (disconnectError) {
            logger.error(
              `❌ Failed to disconnect ${member.user.tag} from voice channel: ${disconnectError.message}. ` +
                `Enable "Move Members" permission in Server Settings → Roles → [Bot's Role] → General Permissions.`,
            );
            continue; // Don't fall back to muting for Connect issues
          }
        } else {
          logger.error(
            `❌ Cannot disconnect ${member.user.tag} - bot missing MoveMembers permission. ` +
              `Enable "Move Members" permission in Server Settings → Roles → [Bot's Role] → General Permissions. ` +
              `Connect restrictions require disconnection, not muting.`,
          );
          continue; // Don't fall back to muting for Connect issues
        }
      }

      // Handle Speak restriction - mute only
      if (!roleCanSpeak && hasMuteMembers) {
        // Only mute if not already muted
        if (!member.voice.mute && !member.voice.selfMute) {
          try {
            await member.voice.setMute(
              true,
              `Scheduled restriction: ${reason} - Role "${role.name}" has Speak disabled`,
            );
            logger.info(
              `🔇 Muted ${member.user.tag} in voice channel due to scheduled role "${role.name}" (Speak disabled)`,
            );
          } catch (muteError) {
            logger.error(
              `❌ Failed to mute ${member.user.tag} in voice channel: ${muteError.message}. ` +
                `Ensure bot has "Mute Members" permission in Server Settings → Roles → [Bot's Role] → General Permissions`,
            );
          }
        } else {
          logger.debug(
            `User ${member.user.tag} already muted (voice.mute=${member.voice.mute}, voice.selfMute=${member.voice.selfMute}) - keeping muted due to restrictive role`,
          );
        }
      } else if (!roleCanSpeak && !hasMuteMembers) {
        logger.error(
          `❌ Cannot mute ${member.user.tag} - bot missing MuteMembers permission. ` +
            `Enable "Mute Members" permission in Server Settings → Roles → [Bot's Role] → General Permissions.`,
        );
      }
    }
  }

  /**
   * Handle unmuting users when restrictive Speak roles are removed
   * @param {Array} operations - Array of operations with member objects
   * @param {string} reason - Reason for the operation
   */
  async handleVoiceUnmute(operations, reason) {
    const logger = getLogger();

    if (operations.length === 0) {
      return;
    }

    // Get guild from first operation to check bot permissions once
    const guild = operations[0]?.member?.guild;
    if (!guild || !guild.members.me) {
      logger.warn(
        "Cannot check bot permissions for voice unmute - guild or bot member not available",
      );
      return;
    }

    const botMember = guild.members.me;
    const hasMuteMembers = botMember.permissions.has("MuteMembers");

    if (!hasMuteMembers) {
      logger.debug(
        "Bot missing 'Mute Members' permission, cannot unmute users",
      );
      return;
    }

    for (const operation of operations) {
      const { member, role } = operation;

      // Check if user is in a voice channel and muted
      if (!member.voice?.channel || !member.voice.mute) {
        continue;
      }

      // Refresh member to get updated role cache after role removal
      try {
        await member.fetch();
      } catch (error) {
        logger.debug(
          `Failed to refresh member ${member.user.tag}:`,
          error.message,
        );
      }

      const channel = member.voice.channel;

      // Check if the removed role had Speak disabled
      const removedRoleHadSpeakDisabled = role
        ? !(channel.permissionsFor(role)?.has("Speak") ?? true)
        : false;

      // Check if user still has any other restrictive Speak role
      let hasOtherRestrictiveSpeakRole = false;
      for (const memberRole of member.roles.cache.values()) {
        if (memberRole.id === role.id) {
          // Skip the role that was just removed (shouldn't be in cache, but just in case)
          continue;
        }

        const rolePermissions = channel.permissionsFor(memberRole);
        const canSpeak = rolePermissions?.has("Speak") ?? true;

        const channelOverrides = channel.permissionOverwrites.cache.get(
          memberRole.id,
        );
        const overrideAllowsSpeak = channelOverrides
          ? channelOverrides.allow.has("Speak")
          : false;
        const overrideDeniesSpeak = channelOverrides
          ? channelOverrides.deny.has("Speak")
          : false;

        if ((!canSpeak || overrideDeniesSpeak) && !overrideAllowsSpeak) {
          hasOtherRestrictiveSpeakRole = true;
          break;
        }
      }

      // If the removed role had Speak disabled AND user doesn't have other restrictive Speak roles,
      // unmute them
      if (removedRoleHadSpeakDisabled && !hasOtherRestrictiveSpeakRole) {
        try {
          await member.voice.setMute(
            false,
            `Restrictive role removed: ${reason}`,
          );
          logger.info(
            `🔊 Unmuted ${member.user.tag} in voice channel - restrictive Speak role "${role.name}" was removed`,
          );
        } catch (unmuteError) {
          logger.warn(
            `Failed to unmute ${member.user.tag} in voice channel:`,
            unmuteError.message,
          );
        }
      }
    }
  }

  /**
   * Execute operation with retry logic and rate limit handling
   */
  async executeWithRetries(operation, expectedCount) {
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const results = await operation();

        // Check if we got rate limited
        const rateLimited = results.some(
          r => r.error && r.error.toLowerCase().includes("rate limit"),
        );

        if (rateLimited) {
          this.logger.warn(
            `Rate limited on attempt ${attempt}, backing off for ${this.rateLimitBackoff}ms`,
          );
          await delay(this.rateLimitBackoff * attempt);
          continue;
        }

        return results;
      } catch (error) {
        lastError = error;
        const isRateLimit = error.message?.toLowerCase().includes("rate limit");

        if (isRateLimit) {
          this.logger.warn(
            `Rate limit error on attempt ${attempt}, backing off for ${this.rateLimitBackoff * attempt}ms`,
          );
          await delay(this.rateLimitBackoff * attempt);
        } else if (attempt < this.maxRetries) {
          this.logger.warn(
            `Operation failed on attempt ${attempt}, retrying in ${this.retryDelay * attempt}ms`,
          );
          await delay(this.retryDelay * attempt);
        }
      }
    }

    // If all retries failed, return error results
    this.logger.error(
      `Operation failed after ${this.maxRetries} attempts:`,
      lastError,
    );
    return Array(expectedCount).fill({
      success: false,
      error: lastError?.message || "Unknown error",
    });
  }
}

// Export singleton instance
let executor = null;

export function getRoleExecutor() {
  if (!executor) {
    executor = new RoleExecutor();
  }
  return executor;
}
