import { getLogger } from "../../logger.js";

/**
 * Select menu interaction router
 * Routes select menu interactions to appropriate handlers based on customId patterns
 */

/**
 * Route select menu interaction to appropriate handler
 * @param {import('discord.js').StringSelectMenuInteraction} interaction - The select menu interaction
 * @param {import('discord.js').Client} _client - The Discord client (unused but kept for consistency)
 */
export async function routeSelectMenuInteraction(interaction, _client) {
  const logger = getLogger();
  const { customId } = interaction;

  try {
    // Route based on customId patterns
    if (customId === "goodbye_channel_select") {
      const { handleGoodbyeChannelSelect } = await import(
        "../handlers/goodbyeChannelSelectHandler.js"
      );
      await handleGoodbyeChannelSelect(interaction);
      return;
    }

    if (customId === "xp_select_channel") {
      const { handleXpChannelSelect } = await import(
        "../../../commands/admin/xp/handlers.js"
      );
      await handleXpChannelSelect(interaction);
      return;
    }

    // Add more select menu routing patterns here as needed
    logger.debug(`Unknown select menu interaction: ${customId}`);
  } catch (error) {
    logger.error(`Error routing select menu interaction ${customId}`, error);
    throw error; // Re-throw to be handled by the main interaction manager
  }
}
