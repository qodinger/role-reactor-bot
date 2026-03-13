import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { getPerformanceMonitor } from "../../../utils/monitoring/performanceMonitor.js";
import { getCommandRateLimiter } from "../../../utils/rateLimit/commandRateLimiter.js";

const logger = getLogger();

/**
 * Command metadata for centralized registry
 */
export const metadata = {
  name: "performance",
  category: "developer",
  description: "View detailed bot performance metrics and memory profiling",
  keywords: [
    "performance",
    "metrics",
    "memory",
    "stats",
    "monitoring",
    "health",
    "debug",
  ],
  emoji: "📊",
  developerOnly: true,
  helpFields: [
    {
      name: `How to Use`,
      value: "```/performance```",
      inline: false,
    },
    {
      name: `What You Need`,
      value: "No parameters needed - developer access required",
      inline: false,
    },
    {
      name: `Permissions`,
      value: "• **Developer** role required (configured in .env)",
      inline: false,
    },
    {
      name: `What You'll See`,
      value:
        "Comprehensive performance metrics including memory usage, command statistics, event processing, database performance, and rate limiter stats!",
      inline: false,
    },
  ],
};

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Get memory profiling data
 * @returns {Object} Memory statistics
 */
function getMemoryProfile() {
  const memoryUsage = process.memoryUsage();

  return {
    heapUsed: memoryUsage.heapUsed,
    heapTotal: memoryUsage.heapTotal,
    rss: memoryUsage.rss,
    external: memoryUsage.external,
    heapUsedPercent: (
      (memoryUsage.heapUsed / memoryUsage.heapTotal) *
      100
    ).toFixed(2),
  };
}

/**
 * Get top commands by execution time
 * @param {Map} commands - Commands metrics map
 * @returns {Array} Top 10 commands
 */
function getTopCommands(commands) {
  return Array.from(commands.metrics.entries())
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      avgDuration: Math.round(stats.totalDuration / stats.count),
      totalDuration: stats.totalDuration,
    }))
    .sort((a, b) => b.totalDuration - a.totalDuration)
    .slice(0, 10);
}

/**
 * Command execution
 */
export async function execute(interaction) {
  const { config } = await import("../../../config/config.js");

  // Check if user is a developer
  if (!config.isDeveloper(interaction.user.id)) {
    return interaction.reply({
      content:
        "🔒 **Developer Only**\n\nThis command is restricted to developers.",
      flags: 64,
    });
  }

  await interaction.deferReply({ flags: 64 });

  try {
    const performanceMonitor = getPerformanceMonitor();
    const rateLimiter = getCommandRateLimiter();

    const memoryProfile = getMemoryProfile();
    const perfSummary = performanceMonitor.getPerformanceSummary();
    const rateLimitStats = rateLimiter.getStats();

    // Calculate uptime
    const uptimeMs = Date.now() - performanceMonitor.startTime;
    const uptimeHours = (uptimeMs / (1000 * 60 * 60)).toFixed(2);

    // Build embed
    const embed = {
      color: 0x5865f2, // Discord blurple
      title: "📊 Performance Metrics",
      timestamp: new Date().toISOString(),
      fields: [
        {
          name: "⏱️ Uptime",
          value: `**${uptimeHours}** hours`,
          inline: true,
        },
        {
          name: "💾 Memory Usage",
          value: `**${formatBytes(memoryProfile.heapUsed)}** / ${formatBytes(memoryProfile.heapTotal)}\n*${memoryProfile.heapUsedPercent}% of heap used*`,
          inline: true,
        },
        {
          name: "🗄️ RSS Memory",
          value: formatBytes(memoryProfile.rss),
          inline: true,
        },
        {
          name: "📈 Command Statistics",
          value: [
            `**Total Commands:** ${perfSummary.totalCommands}`,
            `**Avg Duration:** ${Math.round(perfSummary.avgCommandDuration)}ms`,
            `**Total Events:** ${perfSummary.totalEvents}`,
            `**Avg Event Duration:** ${Math.round(perfSummary.avgEventDuration)}ms`,
          ].join("\n"),
          inline: false,
        },
        {
          name: "🗄️ Database Performance",
          value: [
            `**Total Queries:** ${perfSummary.database.queries}`,
            `**Slow Queries:** ${perfSummary.database.slowQueries}`,
            `**Errors:** ${perfSummary.database.errors}`,
            `**Error Rate:** ${((perfSummary.database.errors / Math.max(1, perfSummary.database.queries)) * 100).toFixed(2)}%`,
          ].join("\n"),
          inline: false,
        },
        {
          name: "🚦 Rate Limiter Stats",
          value: [
            `**Active Cooldowns:** ${rateLimitStats.userCooldowns}`,
            `**Tracked Users:** ${rateLimitStats.trackedUsers}`,
            `**Banned Users:** ${rateLimitStats.bannedUsers}`,
          ].join("\n"),
          inline: false,
        },
        {
          name: "🔥 Top 10 Commands by Total Time",
          value:
            getTopCommands(performanceMonitor.commands)
              .map(
                (cmd, i) =>
                  `${i + 1}. **/${cmd.name}** - ${cmd.count}x (${cmd.avgDuration}ms avg, ${cmd.totalDuration}ms total)`,
              )
              .join("\n") || "No commands executed yet",
          inline: false,
        },
      ],
      footer: {
        text: `Node.js ${process.version} | Platform: ${process.platform}`,
      },
    };

    // Add memory warning if heap usage is high
    if (parseFloat(memoryProfile.heapUsedPercent) > 80) {
      embed.fields.splice(1, 0, {
        name: "⚠️ Memory Warning",
        value: `Heap usage is **${memoryProfile.heapUsedPercent}%**! Consider restarting the bot.`,
        inline: false,
      });
    }

    await interaction.editReply({
      content: null,
      embeds: [embed],
    });

    logger.info(
      `Performance metrics viewed by ${interaction.user.tag} (${interaction.user.id})`,
    );
  } catch (error) {
    logger.error("Failed to get performance metrics:", error);
    await interaction.editReply({
      content: `❌ **Error**\n\nFailed to retrieve performance metrics: ${error.message}`,
      embeds: [],
    });
  }
}

/**
 * Command data definition
 */
export const data = new SlashCommandBuilder()
  .setName(metadata.name)
  .setDescription(metadata.description)
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
