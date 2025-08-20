import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

import { isDeveloper } from "../../utils/discord/permissions.js";
import { getLogger } from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("health")
  .setDescription(
    "🔒 [DEVELOPER ONLY] Check the bot's health and performance status",
  )
  .setDefaultMemberPermissions(0n)
  .setDMPermission(false);

export async function execute(interaction, client) {
  const logger = getLogger();
  const startTime = Date.now();

  await interaction.deferReply({ flags: 64 });

  try {
    if (!isDeveloper(interaction.user.id)) {
      logger.warn("Permission denied for health command", {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      });

      return interaction.editReply({
        content:
          "❌ **Permission Denied**\nYou need developer permissions to use this command.",
        flags: 64,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("🏥 Bot Health Status")
      .setTimestamp()
      .setFooter({
        text: "Role Reactor • Health Check",
        iconURL: client.user.displayAvatarURL(),
      });

    const checks = {
      bot_ready: client.user ? "✅ Ready" : "❌ Not Ready",
      websocket: client.ws.ping < 200 ? "✅ Good" : "⚠️ High Ping",
      uptime: client.uptime
        ? `${Math.floor(client.uptime / 1000 / 60)} minutes`
        : "Unknown",
      guilds: `${client.guilds.cache.size} servers`,
      memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
    };

    const hasErrors = checks.bot_ready.includes("❌");
    const hasWarnings = checks.websocket.includes("⚠️");

    let overallStatus = "healthy";
    let statusColor = "#00FF00";
    let statusEmoji = "✅";
    let statusDescription = "All systems are operating normally! 🚀";

    if (hasErrors) {
      overallStatus = "error";
      statusColor = "#FF0000";
      statusEmoji = "❌";
      statusDescription =
        "Critical issues detected. Immediate attention required! 🔴";
    } else if (hasWarnings) {
      overallStatus = "warning";
      statusColor = "#FFA500";
      statusEmoji = "⚠️";
      statusDescription = "Minor issues detected. Monitor closely. 🟡";
    }

    embed.setColor(statusColor);
    embed.setDescription(statusDescription);

    embed.addFields({
      name: "📊 Overall Status",
      value: `${statusEmoji} **${overallStatus.toUpperCase()}**`,
      inline: false,
    });

    // System Health Checks
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
    const ping = client.ws.ping;
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    embed.addFields({
      name: "📈 Performance Metrics",
      value: [
        `**WebSocket Ping**: ${ping}ms`,
        `**Memory Usage**: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        `**Memory Total**: ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        `**CPU Usage**: ${(cpuUsage.user / 1000).toFixed(2)}s user, ${(cpuUsage.system / 1000).toFixed(2)}s system`,
      ].join("\n"),
      inline: false,
    });

    // Command Status Check
    try {
      const { getCommandHandler } = await import(
        "../../utils/core/commandHandler.js"
      );
      const commandHandler = getCommandHandler();
      const commandDebug = commandHandler.getAllCommandsDebug();

      embed.addFields({
        name: "⚡ Command Status",
        value: [
          `**Total Commands**: ${commandDebug.handlerCount}`,
          `**Synchronized**: ${commandDebug.synchronized ? "✅ Yes" : "❌ No"}`,
          `**Handler Collection**: ${commandDebug.handlerCount} commands`,
          `**Client Collection**: ${commandDebug.clientCount} commands`,
        ].join("\n"),
        inline: false,
      });

      if (!commandDebug.synchronized) {
        const missingInClient = commandDebug.handler.filter(
          cmd => !commandDebug.client.includes(cmd),
        );
        const missingInHandler = commandDebug.client.filter(
          cmd => !commandDebug.handler.includes(cmd),
        );

        if (missingInClient.length > 0 || missingInHandler.length > 0) {
          embed.addFields({
            name: "⚠️ Command Mismatches",
            value: [
              missingInClient.length > 0
                ? `**Missing in Client**: ${missingInClient.join(", ")}`
                : null,
              missingInHandler.length > 0
                ? `**Missing in Handler**: ${missingInHandler.join(", ")}`
                : null,
            ]
              .filter(Boolean)
              .join("\n"),
            inline: false,
          });
        }
      }

      // Show all available commands for debugging
      if (commandDebug.handler.length > 0) {
        const commandList = commandDebug.handler.slice(0, 20); // Limit to first 20 to avoid embed overflow
        const remaining = commandDebug.handler.length - commandList.length;

        embed.addFields({
          name: `📋 Available Commands (${commandDebug.handler.length})`,
          value: [
            commandList.join(", "),
            remaining > 0 ? `... and ${remaining} more` : null,
          ]
            .filter(Boolean)
            .join("\n"),
          inline: false,
        });
      }
    } catch (error) {
      embed.addFields({
        name: "❌ Command Status Error",
        value: `Failed to check command status: ${error.message}`,
        inline: false,
      });
    }

    // Recommendations
    if (hasErrors) {
      embed.addFields({
        name: "🚨 Critical Issues",
        value: [
          "• **Bot not ready**: Check if the bot is properly connected to Discord",
          "• **High memory usage**: Consider restarting the bot",
          "• **High ping**: Check network connectivity",
        ].join("\n"),
        inline: false,
      });
    } else if (hasWarnings) {
      embed.addFields({
        name: "⚠️ Recommendations",
        value: [
          "• **High ping detected**: Monitor network performance",
          "• **Memory usage**: Consider optimization if it continues to increase",
          "• **Uptime**: Bot has been running for a while, consider scheduled restarts",
        ].join("\n"),
        inline: false,
      });
    } else {
      embed.addFields({
        name: "✅ All Systems Normal",
        value: "Everything is running smoothly! No action needed. 🎉",
        inline: false,
      });
    }

    await interaction.editReply({
      embeds: [embed],
      flags: 64,
    });

    const duration = Date.now() - startTime;
    logger.info("Health check command executed", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      overallStatus,
      duration: `${duration}ms`,
    });
  } catch (error) {
    logger.error("Error executing health command", error);

    await interaction.editReply({
      content:
        "❌ **Error**\nAn error occurred while checking the bot's health status. Please try again.",
      flags: 64,
    });
  }
}
