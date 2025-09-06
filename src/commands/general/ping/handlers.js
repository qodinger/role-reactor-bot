import { EMOJIS } from "../../../config/theme.js";
import { getLogger } from "../../../utils/logger.js";
import { createPingEmbed, createErrorEmbed } from "./embeds.js";
import { calculateLatency, formatUptime } from "./utils.js";

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
    const { status, statusEmoji, statusColor, statusDescription } =
      calculateLatency(apiLatency);

    // Get bot uptime
    const uptime = client.uptime;
    const uptimeString = formatUptime(uptime);

    // Create user-friendly embed
    const embed = createPingEmbed(
      status,
      statusEmoji,
      statusColor,
      statusDescription,
      apiLatency,
      latency,
      uptimeString,
      client,
      interaction.user,
    );

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

    const errorEmbed = createErrorEmbed(interaction.user);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
