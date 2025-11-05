import { getDatabaseManager } from "../../utils/storage/databaseManager.js";
import { getLogger } from "../../utils/logger.js";
import {
  bulkAddRoles,
  bulkRemoveRoles,
  getCachedMember,
} from "../../utils/discord/roleManager.js";
import { getNextExecutionTime } from "../../commands/admin/schedule-role/utils.js";
import { getOptimizedRoleExecutor } from "./OptimizedRoleExecutor.js";
import { getUserData } from "../../commands/general/core/utils.js";

class RoleScheduler {
  constructor(client) {
    this.client = client;
    this.logger = getLogger();
    this.interval = null;
    this.recurringInterval = null;
    this.isRunning = false;
    this.lastCheckTime = 0;
    this.checkCooldown = 30000; // 30 seconds between checks (reduced for faster execution)
  }

  start() {
    if (this.isRunning) {
      this.logger.warn("⚠️ Role scheduler is already running");
      return;
    }

    this.logger.info("🕐 Starting role scheduler...");
    this.isRunning = true;

    // Check for one-time schedules every 30 seconds for faster execution
    this.interval = setInterval(async () => {
      try {
        await this.executeDueSchedules();
      } catch (error) {
        this.logger.error("❌ Error in role scheduler (one-time)", error);
      }
    }, 30000).unref(); // 30 seconds

    // Check for recurring schedules every 5 minutes
    this.recurringInterval = setInterval(async () => {
      try {
        await this.executeRecurringSchedules();
      } catch (error) {
        this.logger.error("❌ Error in role scheduler (recurring)", error);
      }
    }, 300000).unref(); // 5 minutes

    this.logger.success(
      "✅ Role scheduler started (one-time: every 30s, recurring: every 5min)",
    );
    this.logger.info("🕐 Running initial schedule check...");
    this.executeDueSchedules();
    this.executeRecurringSchedules();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.recurringInterval) {
      clearInterval(this.recurringInterval);
      this.recurringInterval = null;
    }
    this.isRunning = false;
    this.logger.info("🛑 Role scheduler stopped");
  }

  async executeDueSchedules() {
    const now = Date.now();

    // Prevent multiple executions from running simultaneously
    if (now - this.lastCheckTime < this.checkCooldown) {
      this.logger.debug("Schedule check skipped - too soon since last run");
      return;
    }

    this.lastCheckTime = now;

    const databaseManager = await getDatabaseManager();
    if (!databaseManager?.scheduledRoles) {
      this.logger.debug("Database not ready, skipping schedule execution.");
      return;
    }

    this.logger.debug("🕐 Checking for due scheduled roles...");

    const dueSchedules = await databaseManager.scheduledRoles.findDue();
    this.logger.info(`Found ${dueSchedules.length} due scheduled role(s).`);

    if (dueSchedules.length === 0) {
      return;
    }

    // Group by guild for efficient processing
    const guildGroups = new Map();
    for (const schedule of dueSchedules) {
      const { guildId } = schedule;
      if (!guildGroups.has(guildId)) {
        guildGroups.set(guildId, []);
      }
      guildGroups.get(guildId).push(schedule);
    }

    // Sort guilds by Core member priority
    const prioritizedGuilds = await this.prioritizeGuildsByCoreMembers(
      Array.from(guildGroups.entries()),
    );

    // Process each guild's schedules in priority order
    for (const { guildId, schedules } of prioritizedGuilds) {
      await this.processGuildSchedules(guildId, schedules, databaseManager);
    }
  }

  async executeRecurringSchedules() {
    const databaseManager = await getDatabaseManager();
    if (!databaseManager?.recurringSchedules) {
      this.logger.debug(
        "Database not ready, skipping recurring schedule execution.",
      );
      return;
    }

    this.logger.debug("🔄 Checking for recurring schedules to execute...");

    const activeSchedules =
      await databaseManager.recurringSchedules.findActive();
    this.logger.info(
      `Found ${activeSchedules.length} active recurring schedule(s).`,
    );

    if (activeSchedules.length === 0) {
      return;
    }

    const now = new Date();

    // Filter schedules that should execute
    const schedulesToExecute = [];
    for (const schedule of activeSchedules) {
      try {
        const shouldExecute = await this.shouldExecuteRecurringSchedule(
          schedule,
          now,
        );

        if (shouldExecute) {
          schedulesToExecute.push(schedule);
        }
      } catch (error) {
        this.logger.error(
          `Error processing recurring schedule ${schedule.id}:`,
          error,
        );
      }
    }

    // Sort schedules by Core member priority
    const prioritizedSchedules =
      await this.prioritizeSchedulesByCoreMembers(schedulesToExecute);

    // Execute schedules in priority order
    for (const schedule of prioritizedSchedules) {
      try {
        await this.executeRecurringSchedule(schedule, databaseManager);
      } catch (error) {
        this.logger.error(
          `Error executing recurring schedule ${schedule.id}:`,
          error,
        );
      }
    }
  }

  async shouldExecuteRecurringSchedule(schedule, now) {
    const scheduleConfig = schedule.scheduleConfig;
    const scheduleType = schedule.scheduleType;

    if (!scheduleConfig) {
      return false;
    }

    try {
      // Calculate next execution time
      const nextExecution = getNextExecutionTime(scheduleConfig, scheduleType);

      if (!nextExecution) {
        return false;
      }

      // Check if it's time to execute (allow 5 minute window)
      const timeDiff = now.getTime() - nextExecution.getTime();
      const windowMs = 5 * 60 * 1000; // 5 minutes

      // Check if we haven't executed recently (avoid duplicate executions)
      const lastExecutedAt = schedule.lastExecutedAt
        ? new Date(schedule.lastExecutedAt)
        : null;
      const minIntervalMs = 60000; // 1 minute minimum between executions

      if (
        lastExecutedAt &&
        now.getTime() - lastExecutedAt.getTime() < minIntervalMs
      ) {
        return false;
      }

      // For custom intervals, check based on last execution time
      if (scheduleType === "custom") {
        if (!lastExecutedAt) {
          // First execution - execute now if enough time has passed since creation
          const createdAt = new Date(schedule.createdAt);
          const intervalMs = (scheduleConfig.intervalMinutes || 60) * 60 * 1000;
          return now.getTime() - createdAt.getTime() >= intervalMs;
        }

        const intervalMs = (scheduleConfig.intervalMinutes || 60) * 60 * 1000;
        const nextExecutionTime = lastExecutedAt.getTime() + intervalMs;
        return now.getTime() >= nextExecutionTime;
      }

      // For daily, weekly, monthly - check if within execution window
      return timeDiff >= 0 && timeDiff <= windowMs;
    } catch (error) {
      this.logger.error(
        `Error checking if recurring schedule should execute:`,
        error,
      );
      return false;
    }
  }

  async executeRecurringSchedule(schedule, databaseManager) {
    const guild = this.client.guilds.cache.get(schedule.guildId);
    if (!guild) {
      this.logger.warn(
        `Guild ${schedule.guildId} not found, skipping schedule ${schedule.id}`,
      );
      return;
    }

    const role = guild.roles.cache.get(schedule.roleId);
    if (!role) {
      this.logger.warn(
        `Role ${schedule.roleId} not found in guild ${guild.name}, skipping schedule ${schedule.id}`,
      );
      return;
    }

    const userIds = Array.isArray(schedule.userIds)
      ? schedule.userIds
      : [schedule.userId].filter(Boolean);

    this.logger.info(
      `Executing recurring schedule ${schedule.id}: ${schedule.action} role ${role.name} to ${userIds.length} user(s) in ${guild.name}`,
    );

    // Use optimized executor for large operations (>50 users)
    if (userIds.length > 50) {
      const executor = getOptimizedRoleExecutor();
      const result = await executor.executeRoleOperation(
        guild,
        userIds,
        role,
        schedule.action,
        `Recurring schedule: ${schedule.reason || "No reason provided"}`,
      );

      this.logger.info(
        `✅ Recurring schedule ${schedule.id}: ${result.successCount} successful, ${result.failedCount} failed out of ${result.totalUsers} users`,
      );
    } else {
      // Use standard batch processing for smaller operations
      const operations = [];
      for (const userId of userIds) {
        try {
          const member = await getCachedMember(guild, userId);
          if (!member) {
            this.logger.warn(
              `Member ${userId} not found in guild ${guild.name}`,
            );
            continue;
          }

          if (schedule.action === "assign") {
            if (!member.roles.cache.has(role.id)) {
              operations.push({ member, role, action: "add" });

              // Handle voice channel management when assigning restrictive roles
              // Check if user is in voice channel before role assignment
              if (member.voice?.channel) {
                operations[operations.length - 1].handleVoice = true;
              }
            }
          } else if (schedule.action === "remove") {
            if (member.roles.cache.has(role.id)) {
              operations.push({ member, role, action: "remove" });
            }
          }
        } catch (error) {
          this.logger.error(
            `Error processing user ${userId} for recurring schedule:`,
            error,
          );
        }
      }

      // Execute operations
      if (operations.length > 0) {
        const addOperations = operations.filter(op => op.action === "add");
        const removeOperations = operations.filter(
          op => op.action === "remove",
        );

        if (addOperations.length > 0) {
          const results = await bulkAddRoles(
            addOperations.map(op => ({ member: op.member, role: op.role })),
            `Recurring schedule: ${schedule.reason || "No reason provided"}`,
          );
          const successCount = results.filter(r => r.success).length;
          this.logger.success(
            `✅ Recurring schedule ${schedule.id}: Successfully assigned role to ${successCount}/${addOperations.length} user(s)`,
          );

          // Handle voice channel restrictions for users who were assigned the role
          const voiceOps = addOperations
            .filter((op, idx) => op.handleVoice && results[idx]?.success)
            .map(op => ({ ...op, role })); // Include role for permission checking
          if (voiceOps.length > 0) {
            await this.handleVoiceRestrictions(
              voiceOps,
              schedule.reason || "No reason provided",
            );
          }
        }

        if (removeOperations.length > 0) {
          const results = await bulkRemoveRoles(
            removeOperations.map(op => ({ member: op.member, role: op.role })),
            `Recurring schedule: ${schedule.reason || "No reason provided"}`,
          );
          const successCount = results.filter(r => r.success).length;
          this.logger.success(
            `✅ Recurring schedule ${schedule.id}: Successfully removed role from ${successCount}/${removeOperations.length} user(s)`,
          );
        }
      }
    }

    // Update last executed time
    await databaseManager.recurringSchedules.updateLastExecuted(
      schedule.id,
      new Date(),
    );
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

    // Use centralized voice restriction utility which handles rate limiting
    const { enforceVoiceRestrictions } = await import(
      "../../utils/discord/voiceRestrictions.js"
    );

    // Process voice operations in batches to avoid rate limits
    // Discord allows ~10 voice operations per 10 seconds per user
    // Batch size: 5 operations per batch with 150ms delay
    const batchSize = 5;
    const batchDelay = 150;

    logger.info(
      `Processing ${operations.length} voice restriction operations in batches`,
    );

    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);

      // Process batch in parallel
      const batchPromises = batch.map(async operation => {
        const { member, role } = operation;

        // Check if user is in a voice channel
        if (!member.voice?.channel) {
          return { success: true, skipped: true };
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

        // Use centralized utility which handles rate limiting
        const result = await enforceVoiceRestrictions(
          member,
          `Scheduled restriction: ${reason}`,
        );

        if (result.disconnected) {
          logger.info(
            `🚫 Disconnected ${member.user.tag} from voice channel due to scheduled role "${role.name}" (Connect disabled)`,
          );
        } else if (result.muted) {
          logger.info(
            `🔇 Muted ${member.user.tag} in voice channel due to scheduled role "${role.name}" (Speak disabled)`,
          );
        } else if (result.error) {
          if (result.needsWait) {
            logger.warn(
              `⏸️ Rate limited: Skipped voice restriction for ${member.user.tag} - will retry later`,
            );
          } else {
            logger.warn(
              `⚠️ Failed to enforce voice restriction for ${member.user.tag}: ${result.error}`,
            );
          }
        }

        return { success: !result.error, result };
      });

      await Promise.allSettled(batchPromises);

      // Delay between batches to avoid rate limits
      if (i + batchSize < operations.length) {
        await this.delay(batchDelay);
      }
    }

    logger.info(
      `Completed voice restriction processing for ${operations.length} operations`,
    );
  }

  /**
   * Handle unmuting users when restrictive Speak roles are removed
   * @param {Array} operations - Array of operations with member objects
   * @param {string} reason - Reason for the operation
   */
  async handleVoiceUnmute(operations, reason) {
    const logger = this.logger;

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

    // Use centralized voice restriction utility which handles rate limiting
    const { enforceVoiceRestrictions } = await import(
      "../../utils/discord/voiceRestrictions.js"
    );

    // Process voice operations in batches to avoid rate limits
    const batchSize = 5;
    const batchDelay = 150;

    logger.info(
      `Processing ${operations.length} voice unmute operations in batches`,
    );

    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);

      // Process batch in parallel
      const batchPromises = batch.map(async operation => {
        const { member, role } = operation;

        // Check if user is in a voice channel and muted
        if (!member.voice?.channel || !member.voice.mute) {
          return { success: true, skipped: true };
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

        // Use centralized utility which handles rate limiting and checks restrictions
        const result = await enforceVoiceRestrictions(
          member,
          `Restrictive role removed: ${reason}`,
        );

        if (result.unmuted) {
          logger.info(
            `🔊 Unmuted ${member.user.tag} in voice channel - restrictive Speak role "${role.name}" was removed`,
          );
        } else if (result.error) {
          if (result.needsWait) {
            logger.warn(
              `⏸️ Rate limited: Skipped unmute for ${member.user.tag} - will retry later`,
            );
          } else {
            logger.debug(`Not unmuting ${member.user.tag}: ${result.error}`);
          }
        }

        return { success: result.unmuted || false, result };
      });

      const batchResults = await Promise.allSettled(batchPromises);
      // Log any failures (results are already logged in individual promises)
      const failures = batchResults.filter(r => r.status === "rejected");
      if (failures.length > 0) {
        logger.warn(
          `${failures.length} voice unmute operations failed in batch`,
        );
      }

      // Delay between batches to avoid rate limits
      if (i + batchSize < operations.length) {
        await this.delay(batchDelay);
      }
    }

    logger.info(
      `Completed voice unmute processing for ${operations.length} operations`,
    );
  }

  async processGuildSchedules(guildId, schedules, databaseManager) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) {
      this.logger.warn(`Guild ${guildId} not found, cleaning up schedules.`);
      await this.cleanupSchedulesFromDB(schedules, databaseManager);
      return;
    }

    // Process each schedule
    for (const schedule of schedules) {
      await this.executeSchedule(schedule, guild, databaseManager);
    }
  }

  async executeSchedule(schedule, guild, databaseManager) {
    const role = guild.roles.cache.get(schedule.roleId);
    if (!role) {
      this.logger.warn(
        `Role ${schedule.roleId} not found in guild ${guild.name}, marking schedule ${schedule.id} as executed`,
      );
      await databaseManager.scheduledRoles.markExecuted(schedule.id);
      return;
    }

    const userIds = Array.isArray(schedule.userIds)
      ? schedule.userIds
      : [schedule.userId].filter(Boolean);

    this.logger.info(
      `Executing scheduled role ${schedule.action}: ${role.name} to ${userIds.length} user(s) in ${guild.name} (Schedule ID: ${schedule.id})`,
    );

    // Prepare role operations
    const operations = [];
    for (const userId of userIds) {
      try {
        const member = await getCachedMember(guild, userId);
        if (!member) {
          this.logger.warn(`Member ${userId} not found in guild ${guild.name}`);
          continue;
        }

        if (schedule.action === "assign") {
          if (!member.roles.cache.has(role.id)) {
            operations.push({ member, role, action: "add" });
          }
        } else if (schedule.action === "remove") {
          if (member.roles.cache.has(role.id)) {
            operations.push({ member, role, action: "remove" });
          }
        }
      } catch (error) {
        this.logger.error(
          `Error processing user ${userId} for scheduled role:`,
          error,
        );
      }
    }

    // Use optimized executor for large operations (>50 users)
    if (userIds.length > 50) {
      const executor = getOptimizedRoleExecutor();
      const result = await executor.executeRoleOperation(
        guild,
        userIds,
        role,
        schedule.action,
        `Scheduled role: ${schedule.reason || "No reason provided"}`,
      );

      this.logger.info(
        `✅ Schedule ${schedule.id}: ${result.successCount} successful, ${result.failedCount} failed out of ${result.totalUsers} users`,
      );
    } else if (operations.length > 0) {
      // Use standard batch processing for smaller operations
      const addOperations = operations.filter(op => op.action === "add");
      const removeOperations = operations.filter(op => op.action === "remove");

      if (addOperations.length > 0) {
        const results = await bulkAddRoles(
          addOperations.map(op => ({ member: op.member, role: op.role })),
          `Scheduled role: ${schedule.reason || "No reason provided"}`,
        );
        const successCount = results.filter(r => r.success).length;
        this.logger.success(
          `✅ Schedule ${schedule.id}: Successfully assigned role to ${successCount}/${addOperations.length} user(s)`,
        );

        // Handle voice channel restrictions for users who were just assigned the role
        // Only disconnect users who were successfully assigned and are in voice
        const voiceOperations = addOperations
          .filter(
            (op, idx) => results[idx]?.success && op.member.voice?.channel,
          )
          .map(op => ({ ...op, role })); // Include role for permission checking
        if (voiceOperations.length > 0) {
          await this.handleVoiceRestrictions(
            voiceOperations,
            schedule.reason || "No reason provided",
          );
        }
      }

      if (removeOperations.length > 0) {
        const results = await bulkRemoveRoles(
          removeOperations.map(op => ({ member: op.member, role: op.role })),
          `Scheduled role: ${schedule.reason || "No reason provided"}`,
        );
        const successCount = results.filter(r => r.success).length;
        this.logger.success(
          `✅ Schedule ${schedule.id}: Successfully removed role from ${successCount}/${removeOperations.length} user(s)`,
        );

        // Handle unmuting users when restrictive roles are removed
        const voiceUnmuteOperations = removeOperations
          .filter(
            (op, idx) => results[idx]?.success && op.member.voice?.channel,
          )
          .map(op => ({ ...op, role })); // Include role for permission checking
        if (voiceUnmuteOperations.length > 0) {
          await this.handleVoiceUnmute(
            voiceUnmuteOperations,
            schedule.reason || "No reason provided",
          );
        }
      }
    }

    // Mark as executed
    await databaseManager.scheduledRoles.markExecuted(schedule.id);
  }

  async cleanupSchedulesFromDB(schedules, databaseManager) {
    for (const schedule of schedules) {
      try {
        await databaseManager.scheduledRoles.markExecuted(schedule.id);
      } catch (error) {
        this.logger.error(`Error cleaning up schedule ${schedule.id}:`, error);
      }
    }
  }

  /**
   * Get priority score for Core tier
   * Higher score = higher priority
   * Elite: 3, Premium: 2, Basic: 1, None: 0
   */
  getCoreTierPriority(tier) {
    const tierPriorities = {
      "Core Elite": 3,
      "Core Premium": 2,
      "Core Basic": 1,
    };
    return tierPriorities[tier] || 0;
  }

  /**
   * Check if any user in a schedule is a Core member and get highest tier
   * @param {Object} schedule - Schedule object
   * @returns {Promise<{hasCore: boolean, maxTier: string|null, priority: number}>}
   */
  async getScheduleCorePriority(schedule) {
    try {
      const userIds = Array.isArray(schedule.userIds)
        ? schedule.userIds
        : [schedule.userId].filter(Boolean);

      if (userIds.length === 0) {
        return { hasCore: false, maxTier: null, priority: 0 };
      }

      // Check up to first 10 users for Core status (to avoid too many lookups)
      const usersToCheck = userIds.slice(0, 10);
      let maxPriority = 0;
      let maxTier = null;

      for (const userId of usersToCheck) {
        try {
          const userData = await getUserData(userId);
          if (userData.isCore && userData.coreTier) {
            const tierPriority = this.getCoreTierPriority(userData.coreTier);
            if (tierPriority > maxPriority) {
              maxPriority = tierPriority;
              maxTier = userData.coreTier;
            }
          }
        } catch (error) {
          // Skip user if lookup fails
          this.logger.debug(
            `Failed to check Core status for user ${userId}:`,
            error.message,
          );
        }
      }

      return {
        hasCore: maxPriority > 0,
        maxTier,
        priority: maxPriority,
      };
    } catch (error) {
      this.logger.error(
        `Error checking Core priority for schedule ${schedule.id}:`,
        error,
      );
      return { hasCore: false, maxTier: null, priority: 0 };
    }
  }

  /**
   * Prioritize schedules by Core member status
   * @param {Array} schedules - Array of schedules to prioritize
   * @returns {Promise<Array>} Sorted schedules (Core members first)
   */
  async prioritizeSchedulesByCoreMembers(schedules) {
    if (schedules.length === 0) {
      return [];
    }

    // Get Core priority for each schedule
    const schedulesWithPriority = await Promise.all(
      schedules.map(async schedule => {
        const corePriority = await this.getScheduleCorePriority(schedule);
        return {
          schedule,
          priority: corePriority.priority,
          tier: corePriority.maxTier,
        };
      }),
    );

    // Sort by priority (descending), then by schedule ID for consistency
    schedulesWithPriority.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.schedule.id.localeCompare(b.schedule.id); // Consistent tie-breaker
    });

    // Log priority distribution
    const coreCount = schedulesWithPriority.filter(s => s.priority > 0).length;
    if (coreCount > 0) {
      this.logger.info(
        `🎯 Prioritized ${coreCount}/${schedules.length} schedules with Core members (Elite: ${schedulesWithPriority.filter(s => s.tier === "Core Elite").length}, Premium: ${schedulesWithPriority.filter(s => s.tier === "Core Premium").length}, Basic: ${schedulesWithPriority.filter(s => s.tier === "Core Basic").length})`,
      );
    }

    return schedulesWithPriority.map(s => s.schedule);
  }

  /**
   * Prioritize guilds by Core member status in their schedules
   * @param {Array} guildEntries - Array of [guildId, schedules] tuples
   * @returns {Promise<Array>} Sorted guild entries (Core members first)
   */
  async prioritizeGuildsByCoreMembers(guildEntries) {
    if (guildEntries.length === 0) {
      return [];
    }

    // Get Core priority for each guild's schedules
    const guildsWithPriority = await Promise.all(
      guildEntries.map(async ([guildId, schedules]) => {
        let maxPriority = 0;
        let maxTier = null;

        // Check up to first 3 schedules per guild for Core members
        for (const schedule of schedules.slice(0, 3)) {
          const corePriority = await this.getScheduleCorePriority(schedule);
          if (corePriority.priority > maxPriority) {
            maxPriority = corePriority.priority;
            maxTier = corePriority.maxTier;
          }
        }

        return {
          guildId,
          schedules,
          priority: maxPriority,
          tier: maxTier,
        };
      }),
    );

    // Sort by priority (descending), then by guild ID for consistency
    guildsWithPriority.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.guildId.localeCompare(b.guildId); // Consistent tie-breaker
    });

    // Log priority distribution
    const coreGuilds = guildsWithPriority.filter(g => g.priority > 0).length;
    if (coreGuilds > 0) {
      this.logger.info(
        `🎯 Prioritized ${coreGuilds}/${guildEntries.length} guilds with Core members`,
      );
    }

    return guildsWithPriority;
  }

  /**
   * Delay utility for rate limiting
   */
  delay(ms) {
    return new Promise(resolve => {
      setTimeout(() => resolve(), ms);
    });
  }
}

let scheduler = null;

export function getScheduler(client) {
  if (!scheduler) {
    scheduler = new RoleScheduler(client);
  }
  return scheduler;
}
