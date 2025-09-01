import { EmbedBuilder } from "discord.js";
import { THEME_COLOR } from "../../../config/theme.js";
import { getPerformanceMonitor } from "../../../utils/monitoring/performanceMonitor.js";

// ============================================================================
// PERFORMANCE EMBED BUILDER
// ============================================================================

const SLOW_OPERATION_THRESHOLD = 500; // ms

export async function createPerformanceEmbed(client) {
  const embed = new EmbedBuilder()
    .setTitle("📊 Bot Performance Metrics")
    .setColor(THEME_COLOR)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Performance Monitor",
      iconURL: client.user.displayAvatarURL(),
    });

  try {
    const performanceMonitor = getPerformanceMonitor();
    const performanceSummary = performanceMonitor.getPerformanceSummary();

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
        name: "🔄 Event Rate",
        value: `${performanceSummary.events.rate}/min`,
        inline: true,
      },
    );

    // Slow Operations Analysis
    const slowCommands = getSlowCommands(performanceMonitor);
    const slowEvents = getSlowEvents(performanceMonitor);

    if (slowCommands.length > 0) {
      embed.addFields({
        name: "🐌 Slow Commands",
        value: formatSlowOperations(slowCommands),
        inline: false,
      });
    }

    if (slowEvents.length > 0) {
      embed.addFields({
        name: "🐌 Slow Events",
        value: formatSlowOperations(slowEvents),
        inline: false,
      });
    }

    // Memory and System Info
    const memoryUsage = process.memoryUsage();
    embed.addFields({
      name: "💾 Memory Usage",
      value: [
        `**Heap Used**: ${formatMemory(memoryUsage.heapUsed)}`,
        `**Heap Total**: ${formatMemory(memoryUsage.heapTotal)}`,
        `**External**: ${formatMemory(memoryUsage.external)}`,
        `**RSS**: ${formatMemory(memoryUsage.rss)}`,
      ].join("\n"),
      inline: false,
    });

    // Performance Recommendations
    const recommendations = getPerformanceRecommendations(
      performanceSummary,
      slowCommands,
      slowEvents,
    );
    if (recommendations.length > 0) {
      embed.addFields({
        name: "💡 Recommendations",
        value: recommendations.join("\n"),
        inline: false,
      });
    }
  } catch (_error) {
    // Fallback if performance monitor is unavailable
    embed.addFields({
      name: "⚠️ Performance Monitor Unavailable",
      value:
        "Performance metrics are currently unavailable. Basic system information is shown below.",
      inline: false,
    });

    // Basic system info as fallback
    const memoryUsage = process.memoryUsage();
    embed.addFields({
      name: "💾 Basic System Info",
      value: [
        `**Memory**: ${formatMemory(memoryUsage.heapUsed)}`,
        `**Uptime**: ${formatUptime(process.uptime())}`,
        `**Platform**: ${process.platform}`,
        `**Node Version**: ${process.version}`,
      ].join("\n"),
      inline: false,
    });
  }

  return embed;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getSlowCommands(performanceMonitor) {
  const slowCommands = [];
  for (const [name, metric] of performanceMonitor.commands.metrics.entries()) {
    if (metric.averageDuration > SLOW_OPERATION_THRESHOLD) {
      slowCommands.push({
        name,
        avgDuration: `${metric.averageDuration.toFixed(2)}ms`,
        count: metric.count,
      });
    }
  }
  return slowCommands;
}

function getSlowEvents(performanceMonitor) {
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
  return slowEvents;
}

function formatSlowOperations(operations) {
  if (operations.length === 0) return "None detected";

  return operations
    .map(op => `\`${op.name}\`: ${op.avgDuration} (${op.count} calls)`)
    .join("\n");
}

function formatMemory(bytes) {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

function getPerformanceRecommendations(
  performanceSummary,
  slowCommands,
  slowEvents,
) {
  const recommendations = [];

  if (slowCommands.length > 0) {
    recommendations.push(
      "• Consider optimizing slow commands for better user experience",
    );
  }

  if (slowEvents.length > 0) {
    recommendations.push(
      "• Monitor slow event processing to prevent bottlenecks",
    );
  }

  if (performanceSummary.events.avgDuration > 100) {
    recommendations.push("• Event processing is taking longer than expected");
  }

  if (performanceSummary.commands.avgDuration > 200) {
    recommendations.push("• Command execution could be optimized");
  }

  return recommendations;
}
