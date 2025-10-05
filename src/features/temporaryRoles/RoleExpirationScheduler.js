import { EmbedBuilder } from "discord.js";

import { getDatabaseManager } from "../../utils/storage/databaseManager.js";
import { getLogger } from "../../utils/logger.js";
import {
  bulkRemoveRoles,
  getCachedMember,
} from "../../utils/discord/roleManager.js";
import { THEME } from "../../config/theme.js";

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

    // Process each guild's expired roles in bulk
    for (const [guildId, guildExpiredRoles] of guildGroups) {
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
      const { userId, roleId } = expiredRole;

      try {
        const member = await getCachedMember(guild, userId);
        const role = guild.roles.cache.get(roleId);

        if (!member) {
          this.logger.warn(
            `Member ${userId} not found in guild ${guild.name}, marking for cleanup.`,
          );
          rolesToCleanup.push(expiredRole);
          continue;
        }

        if (!role) {
          this.logger.warn(
            `Role ${roleId} not found in guild ${guild.name}, marking for cleanup.`,
          );
          rolesToCleanup.push(expiredRole);
          continue;
        }

        if (member.roles.cache.has(role.id)) {
          roleRemovals.push({
            member,
            role,
            notifyExpiry: expiredRole.notifyExpiry,
          });
        } else {
          // Role already removed, just clean up database
          rolesToCleanup.push(expiredRole);
        }
      } catch (error) {
        this.logger.error(
          `Error processing expired role ${roleId} for user ${userId}:`,
          error,
        );
        rolesToCleanup.push(expiredRole);
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

        if (result.success && roleRemoval.notifyExpiry) {
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
    await this.cleanupExpiredRolesFromDB([...rolesToCleanup, ...expiredRoles]);
  }

  async cleanupExpiredRolesFromDB(expiredRoles) {
    const databaseManager = await getDatabaseManager();

    // Bulk delete from database
    const deletePromises = expiredRoles.map(expiredRole =>
      databaseManager.temporaryRoles.delete(
        expiredRole.guildId,
        expiredRole.userId,
        expiredRole.roleId,
      ),
    );

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
        .setTitle("⏰ Temporary Role Expired!")
        .setDescription(
          `Your temporary **${role.name}** role in **${guild.name}** has expired and has been automatically removed.`,
        )
        .setColor(THEME.ERROR)
        .setThumbnail(role.iconURL() || guild.iconURL())
        .addFields([
          {
            name: "🎭 Role Details",
            value: [
              `**Name:** ${role.name}`,
              `**Color:** ${role.hexColor}`,
              `**Server:** ${guild.name}`,
            ].join("\n"),
            inline: true,
          },
          {
            name: "⏰ Expiration Info",
            value: [
              `**Expired at:** <t:${Math.floor(Date.now() / 1000)}:F>`,
              `**Status:** Automatically removed`,
              `**Action:** Role has been removed from your account`,
            ].join("\n"),
            inline: true,
          },
        ])
        .setFooter({
          text: "Role Reactor • Temporary Roles",
          iconURL: guild.iconURL(),
        })
        .setTimestamp();

      await member.user.send({ embeds: [embed] });
    } catch {
      this.logger.warn(
        `Could not send expiration notification to ${member.user.tag}`,
      );
    }
  }
}

let scheduler = null;

export function getScheduler(client) {
  if (!scheduler) {
    scheduler = new RoleExpirationScheduler(client);
  }
  return scheduler;
}
