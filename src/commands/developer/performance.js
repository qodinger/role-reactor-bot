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
        content:
          "❌ **Permission Denied**\nYou need developer permissions to use this command.",
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

    // Overall Performance Summary
    embed.addFields(
      {
        name: "⏱️ Uptime",
        value: performanceSummary.uptime,
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

    // Performance Metrics
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

    // Performance Analysis
    if (slowCommands.length > 0 || slowEvents.length > 0) {
      embed.addFields({
        name: "⚠️ Performance Issues Detected",
        value: [
          slowCommands.length > 0
            ? `**Slow Commands (${slowCommands.length}):**\n${slowCommands.map(cmd => `• \`${cmd.name}\`: ${cmd.avgDuration} (${cmd.count} calls)`).join("\n")}`
            : "",
          slowEvents.length > 0
            ? `**Slow Events (${slowEvents.length}):**\n${slowEvents.map(evt => `• \`${evt.name}\`: ${evt.avgDuration} (${evt.count} calls)`).join("\n")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
        inline: false,
      });
    } else {
      embed.addFields({
        name: "✅ Performance Status",
        value:
          "All operations are running within acceptable performance thresholds! 🚀",
        inline: false,
      });
    }

    // Recommendations
    const recommendations = [];
    if (slowCommands.length > 0) {
      recommendations.push(
        "• **Optimize slow commands** - Consider caching or reducing database queries",
      );
    }
    if (slowEvents.length > 0) {
      recommendations.push(
        "• **Review event handlers** - Some events are taking longer than expected",
      );
    }
    if (process.memoryUsage().heapUsed / 1024 / 1024 > 100) {
      recommendations.push(
        "• **Monitor memory usage** - Consider implementing garbage collection",
      );
    }

    if (recommendations.length > 0) {
      embed.addFields({
        name: "🔧 Recommendations",
        value: recommendations.join("\n"),
        inline: false,
      });
    }

    await interaction.editReply({
      embeds: [embed],
      flags: 64,
    });

    logger.info("Performance command executed", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      slowCommands: slowCommands.length,
      slowEvents: slowEvents.length,
    });
  } catch (error) {
    logger.error("Error executing performance command", error);

    await interaction.editReply({
      content:
        "❌ **Error**\nAn error occurred while retrieving performance metrics. Please try again.",
      flags: 64,
    });
  }
}
