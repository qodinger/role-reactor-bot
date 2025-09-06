import { getLogger } from "../../logger.js";

/**
 * Modal interaction router
 * Routes modal interactions to appropriate handlers based on customId patterns
 */

/**
 * Route modal interaction to appropriate handler
 * @param {import('discord.js').ModalSubmitInteraction} interaction - The modal interaction
 * @param {import('discord.js').Client} _client - The Discord client (unused but kept for consistency)
 */
export async function routeModalInteraction(interaction, _client) {
  const logger = getLogger();
  const { customId } = interaction;

  try {
    // Route based on customId patterns
    if (customId.startsWith("xp_config_")) {
      const { handleXPConfigModal } = await import("../handlers/xpHandlers.js");
      await handleXPConfigModal(interaction);
      return;
    }

    // Add more modal routing patterns here as needed
    logger.debug(`Unknown modal interaction: ${customId}`);
  } catch (error) {
    logger.error(`Error routing modal interaction ${customId}`, error);
    throw error; // Re-throw to be handled by the main interaction manager
  }
}
