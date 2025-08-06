import { getLogger } from "../utils/logger.js";
import { getDatabaseManager } from "../utils/storage/databaseManager.js";
import {
  processWelcomeMessage,
  createWelcomeEmbed,
  assignAutoRole,
} from "../utils/discord/welcomeUtils.js";

export const name = "guildMemberAdd";
export const once = false;

export async function execute(member) {
  const logger = getLogger();
  const startTime = Date.now();

  try {
    // Get database manager and welcome settings
    const dbManager = await getDatabaseManager();

    // Check if welcome settings repository is available
    if (!dbManager.welcomeSettings) {
      logger.error("Welcome settings repository is not available");
      return;
    }

    const welcomeSettings = await dbManager.welcomeSettings.getByGuild(
      member.guild.id,
    );

    // Check if welcome system is enabled
    if (!welcomeSettings.enabled || !welcomeSettings.channelId) {
      return;
    }

    // Get the welcome channel
    const welcomeChannel = member.guild.channels.cache.get(
      welcomeSettings.channelId,
    );
    if (!welcomeChannel) {
      logger.warn(
        `Welcome channel ${welcomeSettings.channelId} not found in guild ${member.guild.id}`,
      );
      return;
    }

    // Check if bot has permission to send messages in the channel
    if (
      !welcomeChannel.permissionsFor(member.client.user).has("SendMessages")
    ) {
      logger.warn(
        `Bot lacks SendMessages permission in welcome channel ${welcomeSettings.channelId}`,
      );
      return;
    }

    // Process welcome message with placeholders
    const processedMessage = processWelcomeMessage(
      welcomeSettings.message,
      member,
    );

    // Send welcome message
    logger.info(
      `Welcome settings for ${member.guild.name}: embedEnabled=${welcomeSettings.embedEnabled}, message="${welcomeSettings.message}"`,
    );

    if (welcomeSettings.embedEnabled) {
      const embed = createWelcomeEmbed(welcomeSettings, member);
      logger.info(`Sending embed welcome message to ${welcomeChannel.name}`);
      await welcomeChannel.send({ embeds: [embed] });
    } else {
      logger.info(`Sending text welcome message to ${welcomeChannel.name}`);
      await welcomeChannel.send(processedMessage);
    }

    // Assign auto-role if configured
    if (welcomeSettings.autoRoleId) {
      const roleAssigned = await assignAutoRole(
        member,
        welcomeSettings.autoRoleId,
        logger,
      );
      if (roleAssigned) {
        logger.info(
          `Auto-role successfully assigned to ${member.user.tag} in ${member.guild.name}`,
        );
      } else {
        logger.warn(
          `Failed to assign auto-role to ${member.user.tag} in ${member.guild.name}`,
        );
      }
    }

    logger.info(
      `Welcome message sent for ${member.user.tag} in ${member.guild.name} (${Date.now() - startTime}ms)`,
    );
  } catch (error) {
    logger.error(
      `Failed to process welcome for ${member.user.tag} in ${member.guild.name}`,
      error,
    );
  }
}
