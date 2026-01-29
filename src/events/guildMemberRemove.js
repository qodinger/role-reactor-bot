import { getLogger } from "../utils/logger.js";
import { getDatabaseManager } from "../utils/storage/databaseManager.js";
import {
  processGoodbyeMessage,
  createGoodbyeEmbed,
} from "../utils/discord/goodbyeUtils.js";

export const name = "guildMemberRemove";
export const once = false;

export async function execute(member) {
  const logger = getLogger();
  const startTime = Date.now();

  // Skip bots - don't send goodbye for bots leaving
  if (member.user.bot) {
    logger.debug(`Skipping goodbye for bot: ${member.user.tag}`);
    return;
  }

  try {
    // Get database manager and goodbye settings
    const dbManager = await getDatabaseManager();

    // Check if goodbye settings repository is available
    if (!dbManager.goodbyeSettings) {
      logger.error("Goodbye settings repository is not available");
      return;
    }

    const goodbyeSettings = await dbManager.goodbyeSettings.getByGuild(
      member.guild.id,
    );

    // Check if goodbye system is enabled
    if (!goodbyeSettings.enabled || !goodbyeSettings.channelId) {
      return;
    }

    // Get the goodbye channel
    const goodbyeChannel = member.guild.channels.cache.get(
      goodbyeSettings.channelId,
    );
    if (!goodbyeChannel) {
      logger.warn(
        `Goodbye channel ${goodbyeSettings.channelId} not found in guild ${member.guild.id}`,
      );
      return;
    }

    // Check if bot has permission to send messages in the channel
    if (
      !goodbyeChannel.permissionsFor(member.client.user).has("SendMessages")
    ) {
      logger.warn(
        `Bot lacks SendMessages permission in goodbye channel ${goodbyeSettings.channelId}`,
      );
      return;
    }

    // Process goodbye message with placeholders
    const processedMessage = processGoodbyeMessage(
      goodbyeSettings.message,
      member,
    );

    // Send goodbye message
    logger.info(
      `Goodbye settings for ${member.guild.name}: embedEnabled=${goodbyeSettings.embedEnabled}, message="${goodbyeSettings.message}"`,
    );

    if (goodbyeSettings.embedEnabled) {
      const embed = createGoodbyeEmbed(goodbyeSettings, member);
      logger.info(`Sending embed goodbye message to ${goodbyeChannel.name}`);
      await goodbyeChannel.send({ embeds: [embed] });
    } else {
      logger.info(`Sending text goodbye message to ${goodbyeChannel.name}`);
      await goodbyeChannel.send(processedMessage);
    }

    // Log the departure
    const duration = Date.now() - startTime;
    logger.info(
      `Goodbye message sent for ${member.user.tag} (${member.user.id}) in ${member.guild.name} (${duration}ms)`,
    );
  } catch (error) {
    logger.error("Error in guildMemberRemove event:", error);
  }
}
