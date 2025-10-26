import { MessageFlags } from "discord.js";
import { getLogger } from "../../../utils/logger.js";
import { routeHelpInteraction } from "./handlers.js";

/**
 * Handler class for help command interactions
 */
export class InteractionHandler {
  /**
   * @param {import('discord.js').Client} client
   */
  constructor(client) {
    this.client = client;
    this.logger = getLogger();
  }

  /**
   * Handle all help interactions
   * @param {import('discord.js').MessageComponentInteraction} interaction
   */
  async handleInteraction(interaction) {
    try {
      // Help interactions should be deferred since the original help command defers
      await routeHelpInteraction(interaction, true);
    } catch (error) {
      this.logger.error("Error handling help interaction", error);
      await this.handleInteractionError(interaction, error);
    }
  }

  /**
   * Handle interaction errors
   * @param {import('discord.js').MessageComponentInteraction} interaction
   * @param {Error} _error
   */
  async handleInteractionError(interaction, _error) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: `An error occurred while processing your request.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
