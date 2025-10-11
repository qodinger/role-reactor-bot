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
    // Handle poll creation select menus
    if (customId.startsWith("poll_") && customId.endsWith("_select")) {
      // Check if interaction is already acknowledged
      if (interaction.replied || interaction.deferred) {
        logger.warn(`Interaction ${customId} already acknowledged, skipping`);
        return;
      }

      const { handlePollCreationSelect } = await import(
        "../../../commands/general/poll/handlers.js"
      );
      await handlePollCreationSelect(interaction, _client);
      return;
    }

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

    if (customId === "help_category_select") {
      const { handleHelpInteraction } = await import(
        "../handlers/helpHandlers.js"
      );
      await handleHelpInteraction(interaction);
      return;
    }

    if (customId === "welcome_channel_select") {
      const { handleWelcomeChannelSelect } = await import(
        "../handlers/welcomeChannelSelectHandler.js"
      );
      await handleWelcomeChannelSelect(interaction);
      return;
    }

    if (customId === "goodbye_channel_select") {
      const { handleGoodbyeChannelSelect } = await import(
        "../handlers/goodbyeChannelSelectHandler.js"
      );
      await handleGoodbyeChannelSelect(interaction);
      return;
    }

    if (customId === "welcome_role_select") {
      const { handleWelcomeRoleSelect } = await import(
        "../handlers/welcomeRoleSelectHandler.js"
      );
      await handleWelcomeRoleSelect(interaction);
      return;
    }

    // Add more select menu routing patterns here as needed
    logger.debug(`Unknown select menu interaction: ${customId}`);
  } catch (error) {
    logger.error(`Error routing select menu interaction ${customId}`, error);
    throw error; // Re-throw to be handled by the main interaction manager
  }
}
