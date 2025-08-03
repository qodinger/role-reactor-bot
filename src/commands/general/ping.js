import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription(
    `${EMOJIS.STATUS.LOADING} Check the bot's latency and connection status`,
  );

export async function execute(interaction, client) {
  const logger = getLogger();

  try {
    // Defer the reply to show we're processing
    await interaction.deferReply({ ephemeral: false });

    // Calculate latency
    const sent = Date.now();
    await interaction.editReply(
      `${EMOJIS.STATUS.LOADING} Checking connection...`,
    );
    const latency = Date.now() - sent;

    // Get Discord API latency
    const apiLatency = Math.round(client.ws.ping);

    // Determine status and provide helpful information
    let status, statusEmoji, statusColor, statusDescription;
    if (apiLatency < 100) {
      status = "Excellent";
      statusEmoji = EMOJIS.STATUS.SUCCESS;
      statusColor = THEME.SUCCESS;
      statusDescription = "Your connection is running smoothly! 🚀";
    } else if (apiLatency < 200) {
      status = "Good";
      statusEmoji = EMOJIS.STATUS.INFO;
      statusColor = THEME.INFO;
      statusDescription =
        "Connection is working well. Everything looks good! ✅";
    } else if (apiLatency < 400) {
      status = "Fair";
      statusEmoji = EMOJIS.STATUS.WARNING;
      statusColor = THEME.WARNING;
      statusDescription = "Connection is a bit slow but still functional. ⚠️";
    } else {
      status = "Poor";
      statusEmoji = EMOJIS.STATUS.ERROR;
      statusColor = THEME.ERROR;
      statusDescription =
        "Connection is experiencing issues. You might want to check your internet. 🔴";
    }

    // Get bot uptime
    const uptime = client.uptime;
    const uptimeString = formatUptime(uptime);

    // Create user-friendly embed
    const embed = new EmbedBuilder()
      .setColor(statusColor)
      .setTitle(`${EMOJIS.ACTIONS.QUICK} Bot Status Check`)
      .setDescription(`**${statusEmoji} ${statusDescription}**`)
      .addFields(
        {
          name: `${EMOJIS.STATUS.LOADING} Discord API Latency`,
          value: `\`${apiLatency}ms\` ${getLatencyIndicator(apiLatency)}`,
          inline: true,
        },
        {
          name: `${EMOJIS.ACTIONS.QUICK} Response Time`,
          value: `\`${latency}ms\` ${getLatencyIndicator(latency)}`,
          inline: true,
        },
        {
          name: `${EMOJIS.STATUS.ONLINE} Bot Uptime`,
          value: `\`${uptimeString}\``,
          inline: true,
        },
      )
      .setFooter(
        UI_COMPONENTS.createFooter(
          `Requested by ${interaction.user.username} • ${new Date().toLocaleTimeString()}`,
          interaction.user.displayAvatarURL(),
        ),
      )
      .setTimestamp();

    // Add helpful tips based on status
    if (apiLatency >= 400) {
      embed.addFields({
        name: `${EMOJIS.STATUS.WARNING} Tips for Better Performance`,
        value:
          "• Check your internet connection\n• Try refreshing Discord\n• Consider using a wired connection",
        inline: false,
      });
    }

    // Log the ping request
    logger.info(`Ping command executed by ${interaction.user.tag}`, {
      userId: interaction.user.id,
      guildId: interaction.guild?.id,
      apiLatency,
      responseTime: latency,
      status,
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error executing ping command", error);

    const errorEmbed = new EmbedBuilder()
      .setColor(THEME.ERROR)
      .setTitle(`${EMOJIS.STATUS.ERROR} Connection Check Failed`)
      .setDescription(
        "Sorry! I couldn't check the connection status right now. This might be due to:\n\n• Temporary Discord API issues\n• Network connectivity problems\n• Bot maintenance\n\nPlease try again in a few moments!",
      )
      .setFooter(
        UI_COMPONENTS.createFooter(
          "If this problem persists, contact support",
          interaction.user.displayAvatarURL(),
        ),
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

/**
 * Formats uptime in milliseconds to a human-readable string
 * @param {number} uptime - Uptime in milliseconds
 * @returns {string} Formatted uptime string
 */
function formatUptime(uptime) {
  const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
  const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((uptime % (1000 * 60)) / 1000);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

/**
 * Returns a visual indicator for latency values
 * @param {number} latency - Latency in milliseconds
 * @returns {string} Visual indicator
 */
function getLatencyIndicator(latency) {
  if (latency < 100) return "🟢";
  if (latency < 200) return "🟡";
  if (latency < 400) return "🟠";
  return "🔴";
}
