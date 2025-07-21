import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { isDeveloper } from "../../utils/discord/permissions.js";
import { getPerformanceMonitor } from "../../utils/monitoring/performanceMonitor.js";
import { THEME_COLOR } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";

const SLOW_OPERATION_THRESHOLD = 500; // ms

export const data = new SlashCommandBuilder()
  .setName("performance")
  .setDescription(
    "🔒 [DEVELOPER ONLY] View bot performance metrics and statistics",
  )
  .setDefaultMemberPermissions(0n)
  .setDMPermission(false);

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    if (interaction.replied || interaction.deferred) {
      logger.debug("Interaction already handled, skipping");
      return;
    }

    await interaction.deferReply({ flags: 64 });

    if (!isDeveloper(interaction.user.id)) {
      return interaction.editReply({
        content: "❌ You need developer permissions to use this command!",
        flags: 64,
      });
    }

    const performanceMonitor = getPerformanceMonitor();
    const performanceSummary = performanceMonitor.getPerformanceSummary();

    const slowCommands = [];
    for (const [
      name,
      metric,
    ] of performanceMonitor.commands.metrics.entries()) {
      if (metric.averageDuration > SLOW_OPERATION_THRESHOLD) {
        slowCommands.push({
          name,
          avgDuration: `${metric.averageDuration.toFixed(2)}ms`,
          count: metric.count,
        });
      }
    }

    const slowEvents = [];
    for (const [name, metric] of performanceMonitor.events.metrics.entries()) {
      if (metric.averageDuration > SLOW_OPERATION_THRESHOLD) {
        slowEvents.push({
          name,
          avgDuration: `${metric.averageDuration.toFixed(2)}ms`,
          count: metric.count,
        });
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("📊 Bot Performance Metrics")
      .setColor(THEME_COLOR)
      .setTimestamp()
      .setFooter({
        text: "Role Reactor • Performance Monitor",
        iconURL: client.user.displayAvatarURL(),
      });

    embed.addFields(
      { name: "⏱️ Uptime", value: performanceSummary.uptime, inline: true },
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
        value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(
          2,
        )} MB`,
        inline: true,
      },
    );

    embed.addFields(
      {
        name: "🗄️ Database",
        value: `Queries: ${performanceSummary.database.queries}\nErrors: ${performanceSummary.database.errors}\nError Rate: ${performanceSummary.database.errorRate}`,
        inline: true,
      },
      {
        name: "🐌 Slow Operations",
        value: `${slowEvents.length + slowCommands.length} found`,
        inline: true,
      },
    );

    if (slowEvents.length > 0 || slowCommands.length > 0) {
      const slowDetails = [];

      if (slowCommands.length > 0) {
        slowDetails.push("**Slow Commands:**");
        slowCommands.forEach(cmd => {
          slowDetails.push(
            `• ${cmd.name}: ${cmd.avgDuration} (${cmd.count} uses)`,
          );
        });
      }

      if (slowEvents.length > 0) {
        slowDetails.push("**Slow Events:**");
        slowEvents.forEach(event => {
          slowDetails.push(
            `• ${event.name}: ${event.avgDuration} (${event.count} times)`,
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
