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
        await this.cleanupExpiredRoles();
      } catch (error) {
        this.logger.error("❌ Error in role expiration scheduler", error);
      }
    }, 60000).unref();

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

    const expiredRoles = await databaseManager.temporaryRoles.findExpired();
    if (expiredRoles.length === 0) return;

    this.logger.info(`Found ${expiredRoles.length} expired temporary role(s).`);

    for (const expiredRole of expiredRoles) {
      const { guildId, userId, roleId } = expiredRole;
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
          await member.roles.remove(role, "Temporary role expired");
          this.logger.success(
            `Removed expired role "${role.name}" from ${member.user.tag}.`,
          );
          await this.sendExpirationNotification(member, role, guild);
        }

        await databaseManager.temporaryRoles.delete(guildId, userId, roleId);
      } catch (error) {
        this.logger.error(
          `Error processing expired role for user ${userId}`,
          error,
        );
      }
    }
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
