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
      content: `${EMOJIS.STATUS.ERROR} You don't have permission to use this command.`,
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
          name: `${EMOJIS.FEATURES.BACKUP} Data Retention`,
          value:
            "• Role mappings: Until manually removed\n• Temporary roles: Auto-expire\n• Logs: 30 days\n• Cache: 5 minutes",
          inline: false,
        },
        {
          name: `${EMOJIS.ACTIONS.LINK} Privacy Compliance`,
          value:
            "✅ GDPR/CCPA compliant\n✅ Data portability available\n✅ Automatic cleanup enabled\n✅ No personal data stored\n💡 Use /delete-roles and /remove-temp-role for data deletion",
          inline: false,
        },
      )
      .setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    // Add export functionality
    const exportButton = {
      type: 1,
      components: [
        {
          type: 2,
          style: 2,
          label: "Export All Data",
          custom_id: "export_data",
          emoji: { name: "📤" },
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
