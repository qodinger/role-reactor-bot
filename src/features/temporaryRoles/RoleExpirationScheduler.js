import { getStorageManager } from "../../utils/storage/storageManager.js";
import { getLogger } from "../../utils/logger.js";
import { EmbedBuilder } from "discord.js";

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
    const storageManager = await getStorageManager();
    const tempRoles = await storageManager.getTemporaryRoles();
    const expiredRoles = [];

    for (const [guildId, guildRoles] of Object.entries(tempRoles)) {
      for (const [userId, userRoles] of Object.entries(guildRoles)) {
        for (const [roleId, roleData] of Object.entries(userRoles)) {
          if (new Date(roleData.expiresAt) <= new Date()) {
            expiredRoles.push({ guildId, userId, roleId });
          }
        }
      }
    }

    if (expiredRoles.length === 0) return;

    this.logger.info(
      `⏰ Found ${expiredRoles.length} expired temporary role(s) to clean up`,
    );

    for (const { guildId, userId, roleId } of expiredRoles) {
      try {
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) continue;

        const member = await guild.members.fetch(userId);
        if (!member) continue;

        const role = guild.roles.cache.get(roleId);
        if (!role || !member.roles.cache.has(role.id)) continue;

        await member.roles.remove(role, "Temporary role expired");
        await storageManager.removeTemporaryRole(guildId, userId, roleId);
        this.logger.success(
          `✅ Removed expired role "${role.name}" from ${member.user.tag}`,
        );

        await this.sendExpirationNotification(member, role, guild);
      } catch (error) {
        this.logger.error(
          `❌ Error removing expired role for user ${userId}`,
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
