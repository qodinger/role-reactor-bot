import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getLogger } from "../../utils/logger.js";
import { getStorageManager } from "../../utils/storage/storageManager.js";
import { getDatabaseManager } from "../../utils/storage/databaseManager.js";
import { THEME, EMOJIS } from "../../config/theme.js";
import config from "../../config/config.js";

export const data = new SlashCommandBuilder()
  .setName("storage")
  .setDescription("🔒 [DEVELOPER ONLY] Show storage configuration status")
  .setDefaultMemberPermissions(0n)
  .setDMPermission(false);

export async function execute(interaction, _client) {
  const logger = getLogger();

  // Check if user is a developer
  const developers = config.discord.developers || [];
  if (!developers.includes(interaction.user.id)) {
    await interaction.reply({
      content: `${EMOJIS.STATUS.ERROR} **Permission Denied**\nYou need developer permissions to use this command.`,
      flags: 64,
    });
    return;
  }

  try {
    await interaction.deferReply({ ephemeral: true });

    const storageManager = await getStorageManager();
    const databaseManager = await getDatabaseManager();

    // Get storage statistics
    const roleMappings = await storageManager.getRoleMappings();
    const mappingCount = Object.keys(roleMappings).length;

    // Get temporary roles statistics
    const tempRoles = await storageManager.getTemporaryRoles();
    const tempRoleCount = Object.values(tempRoles).reduce(
      (total, guildRoles) => {
        return (
          total +
          Object.values(guildRoles).reduce((guildTotal, userRoles) => {
            return guildTotal + Object.keys(userRoles).length;
          }, 0)
        );
      },
      0,
    );

    // Database health check
    const dbHealth = await databaseManager.healthCheck();
    const dbStatus = dbHealth ? "✅ Connected" : "❌ Disconnected";

    // Storage type detection
    const storageType = storageManager.provider.constructor.name;
    const storageStatus =
      storageType === "DatabaseProvider" ? "Database" : "Local Files";

    // Create detailed embed
    const embed = new EmbedBuilder()
      .setColor(THEME.DEVELOPER)
      .setTitle(`${EMOJIS.FEATURES.BACKUP} Storage Status`)
      .setDescription("Current storage configuration and statistics")
      .addFields(
        {
          name: `${EMOJIS.STATUS.ONLINE} Storage Type`,
          value: storageStatus,
          inline: true,
        },
        {
          name: `${EMOJIS.STATUS.ONLINE} Database Status`,
          value: dbStatus,
          inline: true,
        },
        {
          name: `${EMOJIS.ACTIONS.VIEW} Role Mappings`,
          value: `${mappingCount} active mappings`,
          inline: true,
        },
        {
          name: `${EMOJIS.FEATURES.TEMPORARY} Temporary Roles`,
          value: `${tempRoleCount} active temporary roles`,
          inline: true,
        },
        {
          name: `${EMOJIS.FEATURES.BACKUP} Data Retention`,
          value:
            "• Role mappings: Until manually removed\n• Temporary roles: Auto-expire\n• Logs: 30 days\n• Cache: 5 minutes",
          inline: false,
        },
      )
      .setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    // Add storage recommendations
    if (storageType === "FileProvider") {
      embed.addFields({
        name: "⚠️ Storage Recommendation",
        value:
          "You're using local file storage. For production use, consider setting up a MongoDB database for better reliability and performance.",
        inline: false,
      });
    }

    if (!dbHealth) {
      embed.addFields({
        name: "🔧 Database Issue",
        value:
          "Database connection failed. The bot is using local file storage as a fallback. Check your MongoDB connection settings.",
        inline: false,
      });
    }

    // Add export functionality
    const exportButton = {
      type: 1,
      components: [
        {
          type: 2,
          style: 2,
          label: "Export Data",
          custom_id: "export_data",
        },
      ],
    };

    await interaction.editReply({
      embeds: [embed],
      components: [exportButton],
    });

    // Log the command usage
    logger.logCommand(
      "storage",
      interaction.user.id,
      Date.now() - interaction.createdTimestamp,
      true,
    );
  } catch (error) {
    logger.error("Error in storage command", error);
    await interaction.editReply({
      content: `${EMOJIS.STATUS.ERROR} Failed to retrieve storage status.`,
    });
  }
}

// Handle export data button
export async function handleExportData(interaction) {
  const logger = getLogger();

  try {
    await interaction.deferReply({ ephemeral: true });

    const storageManager = await getStorageManager();
    const roleMappings = await storageManager.getRoleMappings();

    // Get all guilds where data exists
    const allGuilds = new Set();
    Object.values(roleMappings).forEach(mapping => {
      allGuilds.add(mapping.guildId);
    });

    // Export data from ALL guilds (not just current guild)
    const userData = {
      userId: interaction.user.id,
      exportDate: new Date().toISOString(),
      totalGuilds: allGuilds.size,
      roleMappings, // All role mappings across all guilds
      dataTypes: [
        "Role mappings for all servers",
        "Command usage logs (anonymized)",
        "Temporary role assignments (if any)",
      ],
      retentionInfo: {
        roleMappings: "Retained until manually removed",
        temporaryRoles: "Auto-deleted upon expiration",
        logs: "30 days retention",
        cache: "5 minutes timeout",
      },
    };

    // Create export file
    const exportData = JSON.stringify(userData, null, 2);
    const buffer = Buffer.from(exportData, "utf8");

    await interaction.editReply({
      content: `${EMOJIS.STATUS.SUCCESS} Your data export is ready!`,
      files: [
        {
          attachment: buffer,
          name: `role-reactor-data-${interaction.user.id}-${Date.now()}.json`,
        },
      ],
    });

    logger.info(`Data export requested by ${interaction.user.tag}`, {
      userId: interaction.user.id,
      guildId: interaction.guild?.id,
      exportSize: buffer.length,
    });
  } catch (error) {
    logger.error("Error exporting user data", error);
    await interaction.editReply({
      content: `${EMOJIS.STATUS.ERROR} Failed to export data. Please try again later.`,
    });
  }
}

// Handle cleanup expired roles button
export async function handleCleanupTempRoles(interaction) {
  const logger = getLogger();

  try {
    await interaction.deferReply({ ephemeral: true });

    const databaseManager = await getDatabaseManager();
    const expiredRoles = await databaseManager.temporaryRoles.findExpired();

    if (expiredRoles.length === 0) {
      await interaction.editReply({
        content: `${EMOJIS.STATUS.SUCCESS} No expired temporary roles found.`,
      });
      return;
    }

    let removedCount = 0;
    let errorCount = 0;

    for (const expiredRole of expiredRoles) {
      const { guildId, userId, roleId } = expiredRole;
      try {
        const guild = interaction.client.guilds.cache.get(guildId);
        if (!guild) {
          await databaseManager.temporaryRoles.delete(guildId, userId, roleId);
          removedCount++;
          continue;
        }

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
          await databaseManager.temporaryRoles.delete(guildId, userId, roleId);
          removedCount++;
          continue;
        }

        const role = guild.roles.cache.get(roleId);
        if (!role) {
          await databaseManager.temporaryRoles.delete(guildId, userId, roleId);
          removedCount++;
          continue;
        }

        if (member.roles.cache.has(role.id)) {
          await member.roles.remove(
            role,
            "Manual cleanup of expired temporary role",
          );
          logger.success(
            `Removed expired role "${role.name}" from ${member.user.tag}`,
          );
        }

        await databaseManager.temporaryRoles.delete(guildId, userId, roleId);
        removedCount++;
      } catch (error) {
        logger.error(
          `Error cleaning up expired role for user ${userId}`,
          error,
        );
        errorCount++;
      }
    }

    await interaction.editReply({
      content: `${EMOJIS.STATUS.SUCCESS} Cleanup complete! Removed ${removedCount} expired roles${errorCount > 0 ? `, ${errorCount} errors` : ""}.`,
    });

    logger.info(`Manual cleanup completed by ${interaction.user.tag}`, {
      userId: interaction.user.id,
      guildId: interaction.guild?.id,
      removedCount,
      errorCount,
    });
  } catch (error) {
    logger.error("Error in cleanup command", error);
    await interaction.editReply({
      content: `${EMOJIS.STATUS.ERROR} Failed to cleanup expired roles.`,
    });
  }
}

// Handle test auto cleanup button
export async function handleTestAutoCleanup(interaction) {
  const logger = getLogger();

  try {
    await interaction.deferReply({ ephemeral: true });

    const { getScheduler } = await import(
      "../../features/temporaryRoles/RoleExpirationScheduler.js"
    );
    const scheduler = getScheduler(interaction.client);

    logger.info(
      `Manual auto cleanup test triggered by ${interaction.user.tag}`,
    );

    await interaction.editReply({
      content: `${EMOJIS.STATUS.INFO} Testing automatic cleanup system...`,
    });

    // Trigger the automatic cleanup
    await scheduler.cleanupExpiredRoles();

    await interaction.editReply({
      content: `${EMOJIS.STATUS.SUCCESS} Automatic cleanup test completed! Check the logs for details.`,
    });

    logger.info(`Auto cleanup test completed by ${interaction.user.tag}`);
  } catch (error) {
    logger.error("Error in test auto cleanup", error);
    await interaction.editReply({
      content: `${EMOJIS.STATUS.ERROR} Failed to test automatic cleanup.`,
    });
  }
}
