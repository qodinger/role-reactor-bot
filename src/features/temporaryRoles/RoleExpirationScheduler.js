import { EmbedBuilder } from "discord.js";

import { getDatabaseManager } from "../../utils/storage/databaseManager.js";
import { getLogger } from "../../utils/logger.js";
import {
  bulkRemoveRoles,
  getCachedMember,
} from "../../utils/discord/roleManager.js";
import { THEME, EMOJIS } from "../../config/theme.js";
import {
  getUsersCorePriority,
  sortByCorePriority,
  logPriorityDistribution,
} from "../../commands/general/core/utils.js";

class RoleExpirationScheduler {
  constructor(client) {
    this.client = client;
    this.logger = getLogger();
    this.interval = null;
    this.isRunning = false;
    this.lastCleanupTime = 0;
    this.cleanupCooldown = 30000; // 30 seconds between cleanups
  }

  start() {
    if (this.isRunning) {
      this.logger.warn("⚠️ Role expiration scheduler is already running");
      return;
    }

    this.logger.info("🕐 Starting role expiration scheduler...");
    this.isRunning = true;

    this.interval = setInterval(async () => {
      try {
        this.logger.debug("🕐 Scheduled cleanup triggered");
        await this.cleanupExpiredRoles();
      } catch (error) {
        this.logger.error("❌ Error in role expiration scheduler", error);
      }
    }, 60000).unref();

    this.logger.success(
      "✅ Role expiration scheduler started (runs every 60 seconds)",
    );
    this.logger.info("🕐 Running initial temporary role cleanup...");
    this.cleanupExpiredRoles();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    this.logger.info("🛑 Role expiration scheduler stopped");
  }

  async cleanupExpiredRoles() {
    const now = Date.now();

    // Prevent multiple cleanups from running simultaneously
    if (now - this.lastCleanupTime < this.cleanupCooldown) {
      this.logger.debug("Cleanup skipped - too soon since last run");
      return;
    }

    this.lastCleanupTime = now;

    const databaseManager = await getDatabaseManager();
    if (!databaseManager.temporaryRoles) {
      this.logger.debug("Database not ready, skipping temporary role cleanup.");
      return;
    }

    this.logger.info("🕐 Running automatic temporary role cleanup...");

    const expiredRoles = await databaseManager.temporaryRoles.findExpired();
    this.logger.info(
      `Found ${expiredRoles.length} expired temporary role(s) in database.`,
    );

    if (expiredRoles.length === 0) {
      this.logger.debug("No expired roles found, cleanup complete.");
      return;
    }

    this.logger.info(`Found ${expiredRoles.length} expired temporary role(s).`);

    // Group expired roles by guild for efficient processing
    const guildGroups = new Map();
    for (const expiredRole of expiredRoles) {
      const { guildId } = expiredRole;
      if (!guildGroups.has(guildId)) {
        guildGroups.set(guildId, []);
      }
      guildGroups.get(guildId).push(expiredRole);
    }

    // Prioritize guilds by Core member status
    const prioritizedGuilds = await this.prioritizeGuildsByCoreMembers(
      Array.from(guildGroups.entries()),
    );

    // Process each guild's expired roles in priority order
    for (const {
      guildId,
      expiredRoles: guildExpiredRoles,
    } of prioritizedGuilds) {
      await this.processGuildExpiredRoles(guildId, guildExpiredRoles);
    }
  }

  async processGuildExpiredRoles(guildId, expiredRoles) {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) {
      this.logger.warn(`Guild ${guildId} not found, cleaning up all roles.`);
      await this.cleanupExpiredRolesFromDB(expiredRoles);
      return;
    }

    // Prepare bulk role removal operations
    const roleRemovals = [];
    const rolesToCleanup = [];

    for (const expiredRole of expiredRoles) {
      const { roleId, notifyExpiry } = expiredRole;

      // Handle both old format (single userId) and new format (userIds array)
      const userIds = expiredRole.userIds || [expiredRole.userId];

      for (const userId of userIds) {
        try {
          const member = await getCachedMember(guild, userId);
          const role = guild.roles.cache.get(roleId);

          if (!member) {
            this.logger.warn(
              `Member ${userId} not found in guild ${guild.name}, marking for cleanup.`,
            );
            rolesToCleanup.push({ ...expiredRole, userId });
            continue;
          }

          if (!role) {
            this.logger.warn(
              `Role ${roleId} not found in guild ${guild.name}, marking for cleanup.`,
            );
            rolesToCleanup.push({ ...expiredRole, userId });
            continue;
          }

          if (member.roles.cache.has(role.id)) {
            roleRemovals.push({
              member,
              role,
              notifyExpiry,
              userId, // Store userId for individual processing
            });
          } else {
            // Role already removed, just clean up database
            rolesToCleanup.push({ ...expiredRole, userId });
          }
        } catch (error) {
          this.logger.error(
            `Error processing expired role ${roleId} for user ${userId}:`,
            error,
          );
          rolesToCleanup.push({ ...expiredRole, userId });
        }
      }
    }

    // Bulk remove roles if any exist
    if (roleRemovals.length > 0) {
      this.logger.info(
        `Bulk removing ${roleRemovals.length} expired roles from guild ${guild.name}`,
      );
      const results = await bulkRemoveRoles(
        roleRemovals,
        "Temporary role expired",
      );

      // Send expiration notifications for roles that were successfully removed
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const roleRemoval = roleRemovals[i];

        if (result.success) {
          // Send expiration notification if requested
          if (roleRemoval.notifyExpiry) {
            try {
              await this.sendExpirationNotification(
                roleRemoval.member,
                roleRemoval.role,
                guild,
              );
              this.logger.info(
                `📧 Sent expiration notification to ${roleRemoval.member.user.tag}`,
              );
            } catch (error) {
              this.logger.warn(
                `Failed to send expiration notification to ${roleRemoval.member.user.tag}:`,
                error.message,
              );
            }
          }
        }
      }

      // Log results
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      if (successCount > 0) {
        this.logger.success(
          `✅ Successfully removed ${successCount} expired roles from guild ${guild.name}`,
        );
      }

      if (failureCount > 0) {
        this.logger.warn(
          `⚠️ Failed to remove ${failureCount} expired roles from guild ${guild.name}`,
        );
      }
    }

    // Clean up all expired roles from database
    // so we only need to pass expiredRoles to avoid duplicates
    await this.cleanupExpiredRolesFromDB(expiredRoles);
  }

  async cleanupExpiredRolesFromDB(expiredRoles) {
    const databaseManager = await getDatabaseManager();

    // Group roles by document ID to handle both old and new formats
    const rolesToDelete = new Map();

    for (const expiredRole of expiredRoles) {
      const key = `${expiredRole.guildId}-${expiredRole.roleId}`;

      if (expiredRole.userIds && Array.isArray(expiredRole.userIds)) {
        // New format: single document with userIds array
        if (!rolesToDelete.has(key)) {
          rolesToDelete.set(key, {
            guildId: expiredRole.guildId,
            roleId: expiredRole.roleId,
            userIds: [...expiredRole.userIds],
            isNewFormat: true,
          });
        }
      } else {
        // Old format: individual documents per user
        if (!rolesToDelete.has(key)) {
          rolesToDelete.set(key, {
            guildId: expiredRole.guildId,
            roleId: expiredRole.roleId,
            userIds: [],
            isNewFormat: false,
          });
        }
        rolesToDelete.get(key).userIds.push(expiredRole.userId);
      }
    }

    // Delete from database
    const deletePromises = Array.from(rolesToDelete.values()).map(roleData => {
      if (roleData.isNewFormat) {
        // Delete the entire document for new format
        return databaseManager.temporaryRoles.collection.deleteOne({
          guildId: roleData.guildId,
          roleId: roleData.roleId,
          userIds: { $exists: true },
        });
      } else {
        // Delete individual documents for old format
        return Promise.all(
          roleData.userIds.map(userId =>
            databaseManager.temporaryRoles.delete(
              roleData.guildId,
              userId,
              roleData.roleId,
            ),
          ),
        );
      }
    });

    try {
      await Promise.all(deletePromises);
      this.logger.info(
        `✅ Cleaned up ${expiredRoles.length} expired temporary roles from database`,
      );
    } catch (error) {
      this.logger.error(
        "❌ Error cleaning up expired roles from database:",
        error,
      );
    }
  }

  async sendExpirationNotification(member, role, guild) {
    try {
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.TIME.ALARM} Role Expired`)
        .setDescription(
          `Your **${role.name}** role in **${guild.name}** has been automatically removed`,
        )
        .setColor(THEME.ERROR)
        .addFields([
          {
            name: `${EMOJIS.TIME.CLOCK} Expired`,
            value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
            inline: false,
          },
        ])
        .setFooter({
          text: `Role Reactor • ${guild.name}`,
        })
        .setTimestamp();

      await member.user.send({ embeds: [embed] });
    } catch {
      this.logger.warn(
        `Could not send expiration notification to ${member.user.tag}`,
      );
    }
  }

  /**
   * Check if any user in expired roles is a Core member and get highest tier
   * @param {Array} expiredRoles - Array of expired role objects
   * @returns {Promise<{hasCore: boolean, maxTier: string|null, priority: number}>}
   */
  async getExpiredRolesCorePriority(expiredRoles) {
    try {
      if (expiredRoles.length === 0) {
        return { hasCore: false, maxTier: null, priority: 0 };
      }

      // Extract unique user IDs from expired roles
      const checkedUsers = new Set();
      const userIds = [];

      for (const expiredRole of expiredRoles.slice(0, 10)) {
        const roleUserIds =
          expiredRole.userIds || [expiredRole.userId].filter(Boolean);

        for (const userId of roleUserIds) {
          if (!checkedUsers.has(userId) && checkedUsers.size < 10) {
            checkedUsers.add(userId);
            userIds.push(userId);
          }
        }
      }

      return await getUsersCorePriority(userIds, {
        maxUsers: 10,
        logger: this.logger,
      });
    } catch (error) {
      this.logger.error(
        "Error checking Core priority for expired roles:",
        error,
      );
      return { hasCore: false, maxTier: null, priority: 0 };
    }
  }

  /**
   * Prioritize guilds by Core member status in their expired roles
   * @param {Array} guildEntries - Array of [guildId, expiredRoles] tuples
   * @returns {Promise<Array>} Sorted guild entries (Core members first)
   */
  async prioritizeGuildsByCoreMembers(guildEntries) {
    if (guildEntries.length === 0) {
      return [];
    }

    // Get Core priority for each guild's expired roles
    const guildsWithPriority = await Promise.all(
      guildEntries.map(async ([guildId, expiredRoles]) => {
        const corePriority =
          await this.getExpiredRolesCorePriority(expiredRoles);
        return {
          guildId,
          expiredRoles,
          priority: corePriority.priority,
          tier: corePriority.maxTier,
        };
      }),
    );

    // Sort by priority (descending), then by guild ID for consistency
    sortByCorePriority(guildsWithPriority, "guildId");

    // Log priority distribution
    logPriorityDistribution(
      guildsWithPriority,
      guildEntries.length,
      "guilds",
      this.logger,
    );

    return guildsWithPriority;
  }
}

let scheduler = null;

export function getScheduler(client) {
  if (!scheduler) {
    scheduler = new RoleExpirationScheduler(client);
  }
  return scheduler;
}
