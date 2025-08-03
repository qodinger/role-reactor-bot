import { EmbedBuilder } from "discord.js";

import { getDatabaseManager } from "../../utils/storage/databaseManager.js";
import { getLogger } from "../../utils/logger.js";

class RoleExpirationScheduler {
  constructor(client) {
    this.client = client;
    this.logger = getLogger();
    this.interval = null;
    this.isRunning = false;
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
    const databaseManager = await getDatabaseManager();
    if (!databaseManager.temporaryRoles) {
      this.logger.debug("Database not ready, skipping temporary role cleanup.");
      return;
    }

    this.logger.debug("🕐 Running automatic temporary role cleanup...");

    const expiredRoles = await databaseManager.temporaryRoles.findExpired();
    this.logger.debug(
      `Found ${expiredRoles.length} expired temporary role(s) in database.`,
    );

    if (expiredRoles.length === 0) {
      this.logger.debug("No expired roles found, cleanup complete.");
      return;
    }

    this.logger.info(`Found ${expiredRoles.length} expired temporary role(s).`);

    for (const expiredRole of expiredRoles) {
      const { guildId, userId, roleId } = expiredRole;
      this.logger.debug(
        `Processing expired role: Guild=${guildId}, User=${userId}, Role=${roleId}`,
      );

      try {
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) {
          this.logger.warn(`Guild ${guildId} not found, cleaning up role.`);
          await databaseManager.temporaryRoles.delete(guildId, userId, roleId);
          continue;
        }

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
          this.logger.warn(
            `Member ${userId} not found in guild ${guild.name}, cleaning up role.`,
          );
          await databaseManager.temporaryRoles.delete(guildId, userId, roleId);
          continue;
        }

        const role = guild.roles.cache.get(roleId);
        if (!role) {
          this.logger.warn(
            `Role ${roleId} not found in guild ${guild.name}, cleaning up role.`,
          );
          await databaseManager.temporaryRoles.delete(guildId, userId, roleId);
          continue;
        }

        if (member.roles.cache.has(role.id)) {
          this.logger.info(
            `Removing expired role "${role.name}" from ${member.user.tag}...`,
          );
          await member.roles.remove(role, "Temporary role expired");
          this.logger.success(
            `Removed expired role "${role.name}" from ${member.user.tag}.`,
          );
          await this.sendExpirationNotification(member, role, guild);
        } else {
          this.logger.debug(
            `User ${member.user.tag} no longer has role "${role.name}", cleaning up database entry.`,
          );
        }

        await databaseManager.temporaryRoles.delete(guildId, userId, roleId);
        this.logger.debug(`Cleaned up database entry for expired role.`);
      } catch (error) {
        this.logger.error(
          `Error processing expired role for user ${userId}`,
          error,
        );
      }
    }

    this.logger.debug("🕐 Automatic temporary role cleanup completed.");
  }

  async sendExpirationNotification(member, role, guild) {
    try {
      const embed = new EmbedBuilder()
        .setTitle("⏰ Temporary Role Expired!")
        .setDescription(
          `Your temporary **${role.name}** role in **${guild.name}** has expired.`,
        )
        .setColor(0xff0000)
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
