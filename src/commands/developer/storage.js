import { SlashCommandBuilder } from "discord.js";
import { getStorageManager } from "../../utils/storage/storageManager.js";
import { getLogger } from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("storage")
  .setDescription("🔒 [DEVELOPER ONLY] Show storage status and configuration")
  .setDefaultMemberPermissions(0n)
  .setDMPermission(false);

export async function execute(interaction) {
  const logger = getLogger();

  try {
    // Check if user is developer
    const developers =
      process.env.DEVELOPERS?.split(",").map(id => id.trim()) || [];
    const isDeveloper = developers.includes(interaction.user.id);

    if (!isDeveloper) {
      return interaction.reply({
        content: "❌ You don't have permission to use this command.",
        flags: 64,
      });
    }

    await interaction.deferReply({ flags: 64 });

    const storageManager = await getStorageManager();
    const status = storageManager.getStorageStatus();

    const embed = {
      color: 0x00ff00,
      title: "💾 Storage Status",
      fields: [
        {
          name: "🗄️ Database",
          value: status.database.connected
            ? `✅ Connected (${status.database.type})`
            : "❌ Not connected",
          inline: true,
        },
        {
          name: "📁 Local Storage",
          value: status.local.enabled
            ? `✅ Enabled (${status.local.path})`
            : "❌ Disabled",
          inline: true,
        },
        {
          name: "🔄 Sync",
          value: status.sync.enabled
            ? `✅ Active (${status.sync.interval})`
            : "❌ Inactive",
          inline: true,
        },
        {
          name: "💾 Cache",
          value: `${status.cache.size} items (${status.cache.timeout / 1000}s timeout)`,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: "Role Reactor • Storage Status",
      },
    };

    // Add storage path info
    if (status.local.enabled) {
      embed.fields.push({
        name: "📂 Data Files",
        value: "`role_mappings.json`\n`temporary_roles.json`",
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed], flags: 64 });

    logger.info("Storage status command executed", {
      userId: interaction.user.id,
      status,
    });
  } catch (error) {
    logger.error("❌ Error in storage command", error);
    await interaction.editReply({
      content: "❌ An error occurred while getting storage status.",
      flags: 64,
    });
  }
}
