import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getDatabaseManager } from "../../../utils/storage/databaseManager.js";
import { getLogger } from "../../../utils/logger.js";
import { THEME } from "../../../config/theme.js";

const logger = getLogger();

export const metadata = {
  name: "stats",
  category: "general",
  description: "View bot statistics and usage information",
  keywords: ["stats", "statistics", "servers", "users", "usage"],
  emoji: "📊",
  helpFields: [
    {
      name: `How to Use`,
      value: "```/stats```",
      inline: false,
    },
    {
      name: `What You'll See`,
      value: "Server count, active servers, user count, and command usage",
      inline: false,
    },
  ],
};

export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description);

async function safeCount(collection) {
  try {
    if (collection && typeof collection.countDocuments === "function") {
      return await collection.countDocuments({});
    }
    return 0;
  } catch {
    return 0;
  }
}

export async function execute(interaction) {
  try {
    const client = interaction.client;
    const dbManager = await getDatabaseManager();

    // Basic stats
    const totalServers = client.guilds.cache.size;

    let totalUsers = 0;
    for (const guild of client.guilds.cache.values()) {
      try {
        totalUsers += guild.memberCount || 0;
      } catch {
        // Skip errors
      }
    }

    // Feature usage
    const commandUsageCount = await safeCount(dbManager.commandUsage);
    const automodCount = await safeCount(dbManager.automod);
    const welcomeCount = await safeCount(dbManager.welcomeSettings);
    const tempRolesCount = await safeCount(dbManager.temporaryRoles);
    const giveawaysCount = await safeCount(dbManager.giveaways);

    // Commands today and active servers
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let commandsToday = 0;
    let activeServers = 0;

    try {
      if (
        dbManager.commandUsage &&
        typeof dbManager.commandUsage.find === "function"
      ) {
        const allCommands = await dbManager.commandUsage.find({}).toArray();

        const uniqueGuilds = new Set();

        for (const cmd of allCommands) {
          if (cmd.recentUsage) {
            for (const usage of cmd.recentUsage) {
              // Count today
              if (usage.timestamp >= today) {
                commandsToday++;
              }
              // Count active in 30 days
              if (usage.timestamp >= thirtyDaysAgo && usage.guildId) {
                uniqueGuilds.add(usage.guildId);
              }
            }
          }
        }

        activeServers = uniqueGuilds.size;
      }
    } catch {
      commandsToday = 0;
      activeServers = 0;
    }

    const embed = new EmbedBuilder()
      .setTitle("📊 Bot Statistics")
      .setColor(THEME.PRIMARY)
      .setTimestamp()
      .setFooter({
        text: "Role Reactor • Stats",
        iconURL: client.user?.displayAvatarURL() || null,
      });

    embed.addFields([
      {
        name: "Servers",
        value: [
          `📚 Total: **${totalServers}**`,
          `✨ Active (30d): **${activeServers}**`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "Users",
        value: [`👥 Total: **${totalUsers.toLocaleString()}**`].join("\n"),
        inline: true,
      },
      {
        name: "Commands",
        value: [
          `⚡ Today: **${commandsToday}**`,
          `📈 All time: **${commandUsageCount.toLocaleString()}**`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "Features Used",
        value: [
          `🛡️ Auto-Mod: **${automodCount}** servers`,
          `👋 Welcome: **${welcomeCount}** servers`,
          `⏱️ Temp Roles: **${tempRolesCount}**`,
          `🎁 Giveaways: **${giveawaysCount}**`,
        ].join("\n"),
        inline: false,
      },
    ]);

    await interaction.reply({ embeds: [embed], ephemeral: true });

    logger.debug(`Stats command executed by ${interaction.user.tag}`);
  } catch (error) {
    logger.error("Error in stats command:", error);
    await interaction.reply({
      content: "❌ Failed to load statistics",
      ephemeral: true,
    });
  }
}
