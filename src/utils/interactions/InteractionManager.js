import { getLogger } from "../logger.js";
import { InteractionType } from "discord.js";

/**
 * Centralized interaction manager for handling all Discord interactions
 * Provides a clean, organized way to route and handle different interaction types
 */
export class InteractionManager {
  constructor() {
    this.logger = getLogger();
    this.activeInteractions = new Set();
    this.setupCleanupInterval();
  }

  /**
   * Setup cleanup interval for active interactions tracking
   * Prevents memory leaks by clearing old interactions
   */
  setupCleanupInterval() {
    setInterval(
      () => {
        if (this.activeInteractions.size > 1000) {
          this.activeInteractions.clear();
          this.logger.warn(
            "Cleared interaction tracking cache due to size limit",
          );
        }
      },
      5 * 60 * 1000, // 5 minutes
    );
  }

  /**
   * Main entry point for handling interactions
   * @param {import('discord.js').Interaction} interaction - The Discord interaction
   * @param {import('discord.js').Client} client - The Discord client
   */
  async handleInteraction(interaction, client) {
    const interactionId = `${interaction.id}_${interaction.type}`;

    // Check if this interaction is already being processed
    if (this.activeInteractions.has(interactionId)) {
      this.logger.warn(
        `Interaction ${interactionId} is already being processed, skipping`,
      );
      return;
    }

    // Mark this interaction as being processed
    this.activeInteractions.add(interactionId);

    try {
      // Diagnostic: log interaction age
      const now = Date.now();
      const created =
        interaction.createdTimestamp || interaction.createdAt?.getTime() || now;
      const age = now - created;
      this.logger.debug(
        `[InteractionCreate] Received interaction: ${interaction.commandName || interaction.type} | Age: ${age}ms`,
      );

      // Validate inputs
      if (!interaction || !client) {
        throw new Error("Missing required parameters");
      }

      // Route to appropriate handler based on interaction type
      await this.routeInteraction(interaction, client);
    } catch (error) {
      this.logger.error("Error handling interaction", error);
      // Don't try to reply here - let individual handlers manage their own responses
    } finally {
      // Always remove the interaction from tracking
      this.activeInteractions.delete(interactionId);
    }
  }

  /**
   * Route interaction to appropriate handler based on type
   * @param {import('discord.js').Interaction} interaction - The Discord interaction
   * @param {import('discord.js').Client} client - The Discord client
   */
  async routeInteraction(interaction, client) {
    switch (interaction.type) {
      case InteractionType.ApplicationCommand:
        await this.handleCommandInteraction(interaction, client);
        break;
      case InteractionType.ApplicationCommandAutocomplete:
        await this.handleAutocompleteInteraction(interaction, client);
        break;
      case InteractionType.MessageComponent:
        await this.handleButtonInteraction(interaction, client);
        break;
      case InteractionType.ModalSubmit:
        await this.handleModalInteraction(interaction, client);
        break;
      default:
        // Unknown interaction type, ignore
        this.logger.debug(`Unknown interaction type: ${interaction.type}`);
        break;
    }
  }

  /**
   * Handle command interactions
   * @param {import('discord.js').CommandInteraction} interaction - The command interaction
   * @param {import('discord.js').Client} client - The Discord client
   */
  async handleCommandInteraction(interaction, client) {
    try {
      const { getCommandHandler } = await import("../core/commandHandler.js");
      const commandHandler = getCommandHandler();

      await commandHandler.executeCommand(interaction, client);
      this.logger.info(
        `Command executed: ${interaction.commandName} by ${interaction.user.tag}`,
      );
    } catch (error) {
      this.logger.error(
        `Error executing command ${interaction.commandName}`,
        error,
      );
      // Don't try to reply here - let the command handle its own errors
    }
  }

  /**
   * Handle autocomplete interactions
   * @param {import('discord.js').AutocompleteInteraction} interaction - The autocomplete interaction
   * @param {import('discord.js').Client} client - The Discord client
   */
  async handleAutocompleteInteraction(interaction, client) {
    const command = client.commands.get(interaction.commandName);

    if (command && command.autocomplete) {
      try {
        await command.autocomplete(interaction, client);
      } catch (error) {
        this.logger.error(
          `Error in autocomplete for ${interaction.commandName}`,
          error,
        );
        await interaction.respond([]);
      }
    } else {
      await interaction.respond([]);
    }
  }

  /**
   * Handle button interactions
   * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
   * @param {import('discord.js').Client} client - The Discord client
   */
  async handleButtonInteraction(interaction, client) {
    try {
      // Check if it's actually a select menu interaction
      if (interaction.isStringSelectMenu()) {
        const selectMenuRouter = await import("./routers/selectMenuRouter.js");
        await selectMenuRouter.routeSelectMenuInteraction(interaction, client);
        return;
      }

      // Import button handlers dynamically to reduce initial bundle size
      const buttonRouter = await import("./routers/buttonRouter.js");
      await buttonRouter.routeButtonInteraction(interaction, client);
    } catch (error) {
      this.logger.error(
        `Error handling button interaction ${interaction.customId}`,
        error,
      );

      // Only reply if the interaction hasn't been responded to yet
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: "❌ An error occurred while processing your request.",
            flags: 64,
          });
        } catch (replyError) {
          this.logger.error("Error sending error reply", replyError);
        }
      }
    }
  }

  /**
   * Handle modal interactions
   * @param {import('discord.js').ModalSubmitInteraction} interaction - The modal interaction
   * @param {import('discord.js').Client} client - The Discord client
   */
  async handleModalInteraction(interaction, client) {
    try {
      // Import modal handlers dynamically to reduce initial bundle size
      const modalRouter = await import("./routers/modalRouter.js");
      await modalRouter.routeModalInteraction(interaction, client);
    } catch (error) {
      this.logger.error(
        `Error handling modal interaction ${interaction.customId}`,
        error,
      );

      // Only reply if the interaction hasn't been responded to yet
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: "❌ An error occurred while processing your request.",
            flags: 64,
          });
        } catch (replyError) {
          this.logger.error("Error sending error reply", replyError);
        }
      }
    }
  }
}
