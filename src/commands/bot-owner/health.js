import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { hasBotManagementPermissions } from "../../utils/permissions.js";
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

    // Create health status embed
    const embed = new EmbedBuilder()
      .setTitle("🏥 Bot Health Status")
      .setTimestamp()
      .setFooter({
        text: "Role Reactor • Health Check",
        iconURL: client.user.displayAvatarURL(),
      });

    // Basic health checks
    const checks = {
      bot_ready: client.user ? "✅ Ready" : "❌ Not Ready",
      websocket: client.ws.ping < 200 ? "✅ Good" : "⚠️ High Ping",
      uptime: client.uptime
        ? `${Math.floor(client.uptime / 1000 / 60)} minutes`
        : "Unknown",
      guilds: `${client.guilds.cache.size} servers`,
      memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
    };

    // Determine overall status
    const hasErrors = checks.bot_ready.includes("❌");
    const hasWarnings = checks.websocket.includes("⚠️");

    let overallStatus = "healthy";
    let statusColor = "#00FF00";
    let statusEmoji = "✅";

    if (hasErrors) {
      overallStatus = "error";
      statusColor = "#FF0000";
      statusEmoji = "❌";
    } else if (hasWarnings) {
      overallStatus = "warning";
      statusColor = "#FFA500";
      statusEmoji = "⚠️";
    }

    embed.setColor(statusColor);

    // Add overall status
    embed.addFields({
      name: "📊 Overall Status",
      value: `${statusEmoji} **${overallStatus.toUpperCase()}**`,
      inline: false,
    });

    // Add individual check results
    for (const [checkName, checkResult] of Object.entries(checks)) {
      embed.addFields({
        name: `${checkName.replace(/_/g, " ").toUpperCase()}`,
        value: checkResult,
        inline: true,
      });
    }

    // Add additional info
    embed.addFields({
      name: "🤖 Bot Information",
      value: `**Ping:** ${client.ws.ping}ms\n**Environment:** ${process.env.NODE_ENV || "development"}\n**Node.js:** ${process.version}`,
      inline: true,
    });

    await interaction.editReply({
      embeds: [embed],
      flags: 64,
    });

    // Log command execution
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
