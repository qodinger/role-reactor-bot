import { EmbedBuilder } from "discord.js";
import { THEME, EMOJIS } from "../../../config/theme.js";

// ============================================================================
// HEALTH EMBED BUILDER
// ============================================================================

export async function createHealthEmbed(client, startTime) {
  const embed = new EmbedBuilder()
    .setTitle("🏥 Bot Health Status")
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Health Check",
      iconURL: client.user.displayAvatarURL(),
    });

  // System health checks
  const checks = await getSystemChecks(client);

  // Determine overall status
  const status = determineOverallStatus(checks);

  embed.setColor(status.color);
  embed.setDescription(status.description);

  // Overall Status
  embed.addFields({
    name: "📊 Overall Status",
    value: `${status.emoji} **${status.status.toUpperCase()}**`,
    inline: false,
  });

  // System Health
  embed.addFields({
    name: "🔧 System Health",
    value: [
      `**Bot Status**: ${checks.bot_ready}`,
      `**WebSocket**: ${checks.websocket}`,
      `**Uptime**: ${checks.uptime}`,
      `**Memory Usage**: ${checks.memory}`,
      `**Servers**: ${checks.guilds}`,
    ].join("\n"),
    inline: false,
  });

  // Performance Metrics
  embed.addFields({
    name: "⚡ Performance Metrics",
    value: [
      `**Response Time**: ${Date.now() - startTime}ms`,
      `**WebSocket Ping**: ${checks.ping}ms`,
      `**Heap Used**: ${checks.heapUsed}`,
      `**Heap Total**: ${checks.heapTotal}`,
      `**External Memory**: ${checks.externalMemory}`,
    ].join("\n"),
    inline: false,
  });

  // Process Information
  embed.addFields({
    name: "🖥️ Process Info",
    value: [
      `**Node Version**: ${process.version}`,
      `**Platform**: ${process.platform}`,
      `**Architecture**: ${process.arch}`,
      `**PID**: ${process.pid}`,
      `**Uptime**: ${formatUptime(process.uptime())}`,
    ].join("\n"),
    inline: false,
  });

  return embed;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getSystemChecks(client) {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  return {
    bot_ready: client.user ? "✅ Ready" : "❌ Not Ready",
    websocket: client.ws.ping < 200 ? "✅ Good" : "⚠️ High Ping",
    uptime: client.uptime
      ? `${Math.floor(client.uptime / 1000 / 60)} minutes`
      : "Unknown",
    guilds: `${client.guilds.cache.size} servers`,
    memory: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    ping: client.ws.ping,
    heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    externalMemory: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
    cpuUsage: `${(cpuUsage.user / 1000).toFixed(2)}s user, ${(cpuUsage.system / 1000).toFixed(2)}s system`,
  };
}

function determineOverallStatus(checks) {
  const hasErrors = checks.bot_ready.includes(EMOJIS.STATUS.ERROR);
  const hasWarnings = checks.websocket.includes(EMOJIS.STATUS.WARNING);

  if (hasErrors) {
    return {
      status: "error",
      color: THEME.ERROR,
      emoji: EMOJIS.STATUS.ERROR,
      description: "Critical issues detected. Immediate attention required! 🔴",
    };
  } else if (hasWarnings) {
    return {
      status: "warning",
      color: THEME.WARNING,
      emoji: EMOJIS.STATUS.WARNING,
      description: "Minor issues detected. Monitor closely. 🟡",
    };
  } else {
    return {
      status: "healthy",
      color: THEME.SUCCESS,
      emoji: EMOJIS.STATUS.SUCCESS,
      description: "All systems are operating normally! 🚀",
    };
  }
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
