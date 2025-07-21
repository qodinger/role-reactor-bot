import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import fs from "fs";
import path from "path";
import { getStorageManager } from "../../utils/storage/storageManager.js";
import { getLogger } from "../../utils/logger.js";
import { isDeveloper } from "../../utils/discord/permissions.js";
import { THEME_COLOR } from "../../config/theme.js";

export const data = new SlashCommandBuilder()
  .setName("storage")
  .setDescription("🔒 [DEVELOPER ONLY] Show storage status and configuration")
  .setDefaultMemberPermissions(0n)
  .setDMPermission(false);

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    if (!isDeveloper(interaction.user.id)) {
      return interaction.reply({
        content: "❌ You don't have permission to use this command.",
        flags: 64,
      });
    }

    await interaction.deferReply({ flags: 64 });

    const storageManager = await getStorageManager();
    const providerName = storageManager.provider.constructor.name;
    const isDbConnected = providerName === "DatabaseProvider";

    const embed = new EmbedBuilder()
      .setTitle("💾 Storage Status")
      .setColor(isDbConnected ? THEME_COLOR : 0xffa500)
      .setTimestamp()
      .setFooter({
        text: "Role Reactor • Storage Status",
        iconURL: client.user.displayAvatarURL(),
      });

    if (isDbConnected) {
      const dbManager = storageManager.provider.dbManager;
      const isHealthy = await dbManager.healthCheck();
      const roleMappingsCount =
        await dbManager.roleMappings.collection.countDocuments();
      const tempRolesCount =
        await dbManager.temporaryRoles.collection.countDocuments();

      embed.addFields(
        {
          name: "Provider",
          value: "✅ Database",
          inline: true,
        },
        {
          name: "DB Status",
          value: isHealthy ? "Healthy" : "Unhealthy",
          inline: true,
        },
        {
          name: "DB Name",
          value: dbManager.connectionManager.config.name,
          inline: true,
        },
        {
          name: "Role Mappings",
          value: `${roleMappingsCount} documents`,
          inline: true,
        },
        {
          name: "Temp Roles",
          value: `${tempRolesCount} documents`,
          inline: true,
        },
        {
          name: "Cache Size",
          value: `${dbManager.cacheManager.cache.size} items`,
          inline: true,
        },
      );
    } else {
      const { storagePath } = storageManager.provider;
      const mappingsPath = path.join(storagePath, "role_mappings.json");
      const tempRolesPath = path.join(storagePath, "temporary_roles.json");

      const getFileInfo = filePath => {
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          return `Exists (${(stats.size / 1024).toFixed(2)} KB)`;
        }
        return "Not found";
      };

      embed.addFields(
        {
          name: "Provider",
          value: "⚠️ Local File System",
          inline: true,
        },
        {
          name: "Storage Path",
          value: `\`${storagePath}\``,
          inline: true,
        },
        { name: "\u200B", value: "\u200B", inline: true }, // Spacer
        {
          name: "Role Mappings File",
          value: getFileInfo(mappingsPath),
          inline: true,
        },
        {
          name: "Temp Roles File",
          value: getFileInfo(tempRolesPath),
          inline: true,
        },
      );
    }

    await interaction.editReply({ embeds: [embed] });

    logger.info("Storage status command executed", {
      userId: interaction.user.id,
      provider: providerName,
    });
  } catch (error) {
    logger.error("❌ Error in storage command", error);
    await interaction.editReply({
      content: "❌ An error occurred while getting storage status.",
      flags: 64,
    });
  }
}
