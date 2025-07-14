import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { hasAdminPermissions } from "../../utils/permissions.js";
import { getPerformanceMonitor } from "../../utils/performanceMonitor.js";
import { getCommandHandler } from "../../utils/commandHandler.js";
import { THEME_COLOR } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("performance")
  .setDescription("View bot performance metrics and statistics")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    // Check if already replied to prevent double responses
    if (interaction.replied || interaction.deferred) {
      logger.debug("Interaction already handled, skipping");
      return;
    }

    await interaction.deferReply({ flags: 64 });

    if (!hasAdminPermissions(interaction.member)) {
      return interaction.editReply({
        content: "❌ You need administrator permissions to use this command!",
        flags: 64,
      });
    }

    // Get performance data
    const performanceMonitor = getPerformanceMonitor();
    const commandHandler = getCommandHandler();

    const performanceSummary = performanceMonitor.getPerformanceSummary();
    const commandStats = commandHandler.getCommandStats();
    const slowOperations = performanceMonitor.getSlowOperations(500); // 500ms threshold

    // Create main embed
    const embed = new EmbedBuilder()
      .setTitle("📊 Bot Performance Metrics")
      .setColor(THEME_COLOR)
      .setTimestamp()
      .setFooter({
        text: "Role Reactor • Performance Monitor",
        iconURL: client.user.displayAvatarURL(),
      });

    // Uptime and basic stats
    embed.addFields(
      {
        name: "⏱️ Uptime",
        value: performanceSummary.uptime.formatted,
        inline: true,
      },
      {
        name: "🎯 Total Events",
        value: performanceSummary.events.total.toString(),
        inline: true,
      },
      {
        name: "⚡ Total Commands",
        value: performanceSummary.commands.total.toString(),
        inline: true,
      },
    );

    // Performance metrics
    embed.addFields(
      {
        name: "🚀 Event Performance",
        value: `Avg: ${performanceSummary.events.avgDuration}`,
        inline: true,
      },
      {
        name: "⚡ Command Performance",
        value: `Avg: ${performanceSummary.commands.avgDuration}`,
        inline: true,
      },
      {
        name: "💾 Memory Usage",
        value: performanceSummary.memory.current.heapUsed,
        inline: true,
      },
    );

    // Database stats
    embed.addFields(
      {
        name: "🗄️ Database",
        value: `Queries: ${performanceSummary.database.queries}\nErrors: ${performanceSummary.database.errors}\nError Rate: ${performanceSummary.database.errorRate}`,
        inline: true,
      },
      {
        name: "📈 Memory Trend",
        value: `${performanceSummary.memory.trend.trend} (${performanceSummary.memory.trend.change})`,
        inline: true,
      },
      {
        name: "🐌 Slow Operations",
        value: `${slowOperations.slowEvents.length + slowOperations.slowCommands.length} found`,
        inline: true,
      },
    );

    // Top commands by usage
    const topCommands = Object.entries(commandStats)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([name, stats]) => `${name}: ${stats.count} uses`)
      .join("\n");

    if (topCommands) {
      embed.addFields({
        name: "🏆 Top Commands",
        value: topCommands,
        inline: false,
      });
    }

    // Slow operations details
    if (
      slowOperations.slowEvents.length > 0 ||
      slowOperations.slowCommands.length > 0
    ) {
      const slowDetails = [];

      if (slowOperations.slowCommands.length > 0) {
        slowDetails.push("**Slow Commands:**");
        slowOperations.slowCommands.forEach(cmd => {
          slowDetails.push(
            `• ${cmd.command}: ${cmd.avgDuration} (${cmd.count} uses)`,
          );
        });
      }

      if (slowOperations.slowEvents.length > 0) {
        slowDetails.push("**Slow Events:**");
        slowOperations.slowEvents.forEach(event => {
          slowDetails.push(
            `• ${event.event}: ${event.avgDuration} (${event.count} times)`,
          );
        });
      }

      embed.addFields({
        name: "🐌 Slow Operations Details",
        value: slowDetails.join("\n"),
        inline: false,
      });
    }

    await interaction.editReply({
      embeds: [embed],
      flags: 64,
    });
  } catch (error) {
    logger.error("Error getting performance metrics", error);

    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content:
            "❌ **Error**\nAn error occurred while getting performance metrics. Please try again.",
          flags: 64,
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content:
            "❌ **Error**\nAn error occurred while getting performance metrics. Please try again.",
          flags: 64,
        });
      }
    } catch (replyError) {
      logger.error("Failed to send error response", replyError);
    }
  }
}
