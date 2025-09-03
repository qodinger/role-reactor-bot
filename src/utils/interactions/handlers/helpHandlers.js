import { getLogger } from "../../logger.js";

/**
 * Help button interaction handlers
 * Handles all help-related button interactions
 */

/**
 * Handle help command interactions
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleHelpInteraction = async interaction => {
  const logger = getLogger();

  try {
    // Import the help interaction handler dynamically to avoid circular dependencies
    const { InteractionHandler } = await import(
      "../../../commands/general/help/interactionHandler.js"
    );
    const helpHandler = new InteractionHandler(interaction.client);
    await helpHandler.handleInteraction(interaction);
  } catch (error) {
    logger.error("Error handling help interaction", error);

    // Send error response if possible
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "❌ An error occurred while processing your help request.",
          flags: 64,
        });
      } catch (replyError) {
        logger.error("Error sending help error reply", replyError);
      }
    }
  }
};
