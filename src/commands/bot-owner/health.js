import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { hasBotManagementPermissions } from "../../utils/permissions.js";
import { getHealthCheck } from "../../utils/healthCheck.js";
import { getLogger } from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("health")
  .setDescription("Check the bot's health and performance status")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction, client) {
  const logger = getLogger();
  const startTime = Date.now();

  await interaction.deferReply({ flags: 64 });

  try {
    // Check permissions
    if (!hasBotManagementPermissions(interaction.user.id)) {
      logger.warn("Permission denied for health command", {
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      });

      return interaction.editReply({
        content:
          "❌ **Permission Denied**\nYou need bot owner/developer permissions to use this command.",
        flags: 64,
      });
    }

    // Get health check results
    const healthCheck = getHealthCheck();
    const healthSummary = await healthCheck.getHealthSummary(client);

    // Create health status embed
    const embed = new EmbedBuilder()
      .setTitle("🏥 Bot Health Status")
      .setTimestamp()
      .setFooter({
        text: "Role Reactor • Health Check",
        iconURL: client.user.displayAvatarURL(),
      });

    // Set color based on overall status
    const statusColors = {
      healthy: "#00FF00",
      warning: "#FFA500",
      error: "#FF0000",
    };

    embed.setColor(statusColors[healthSummary.overall] || "#808080");

    // Add overall status
    const statusEmoji = {
      healthy: "✅",
      warning: "⚠️",
      error: "❌",
    };

    embed.addFields({
      name: "📊 Overall Status",
      value: `${statusEmoji[healthSummary.overall]} **${healthSummary.overall.toUpperCase()}**`,
      inline: false,
    });

    // Add individual check results
    for (const [checkName, checkResult] of Object.entries(
      healthSummary.checks,
    )) {
      const checkEmoji = {
        healthy: "✅",
        warning: "⚠️",
        error: "❌",
      };

      embed.addFields({
        name: `${checkEmoji[checkResult.status]} ${checkName.replace(/_/g, " ").toUpperCase()}`,
        value: checkResult.details,
        inline: true,
      });
    }

    // Add performance metrics
    const performanceMonitor = getHealthCheck();
    const lastCheck = performanceMonitor.getLastHealthCheck();

    if (lastCheck) {
      embed.addFields({
        name: "⏱️ Last Check",
        value: `Duration: ${lastCheck.duration}\nTime: ${new Date(lastCheck.timestamp).toLocaleTimeString()}`,
        inline: true,
      });
    }

    // Add bot info
    embed.addFields({
      name: "🤖 Bot Information",
      value: `**Uptime:** ${client.uptime ? `${Math.floor(client.uptime / 1000 / 60)} minutes` : "Unknown"}\n**Ping:** ${client.ws.ping}ms\n**Guilds:** ${client.guilds.cache.size}`,
      inline: true,
    });

    await interaction.editReply({
      embeds: [embed],
      flags: 64,
    });

    // Log command execution
    const duration = Date.now() - startTime;
    logger.logCommand("health", interaction.user.id, duration, true);

    logger.info("Health check command executed", {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      overallStatus: healthSummary.overall,
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Error executing health command", error);
    logger.logCommand("health", interaction.user.id, duration, false);

    await interaction.editReply({
      content:
        "❌ **Error**\nAn error occurred while checking the bot's health status. Please try again.",
      flags: 64,
    });
  }
}
