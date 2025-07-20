import { getLogger } from "../../../utils/logger.js";
import { HelpEmbedBuilder } from "./helpEmbedBuilder.js";
import { HelpComponentBuilder } from "./helpComponentBuilder.js";
import { EMOJIS } from "../../../config/theme.js";

/**
 * Handler class for help command interactions
 */
export class HelpInteractionHandler {
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
      if (interaction.customId === "help_category_select") {
        await this.handleCategorySelect(interaction);
      } else if (interaction.customId.startsWith("help_cmd_")) {
        await this.handleCommandButton(interaction);
      } else if (interaction.customId === "help_back_main") {
        await this.handleBackToMain(interaction);
      }
    } catch (error) {
      this.logger.error("Error handling help interaction", error);
      await this.handleInteractionError(interaction, error);
    }
  }

  /**
   * Handle category selection from dropdown
   * @param {import('discord.js').MessageComponentInteraction} interaction
   */
  async handleCategorySelect(interaction) {
    const categoryKey = interaction.values[0].replace("category_", "");
    const categoryEmbed = HelpEmbedBuilder.createCategoryEmbed(
      categoryKey,
      this.client,
    );

    if (categoryEmbed) {
      const components = await HelpComponentBuilder.createCategoryComponents(
        categoryKey,
        interaction.member,
        this.client,
      );
      await interaction.update({
        embeds: [categoryEmbed],
        components,
      });
    }
  }

  /**
   * Handle command button clicks
   * @param {import('discord.js').MessageComponentInteraction} interaction
   */
  async handleCommandButton(interaction) {
    const cmdName = interaction.customId.replace("help_cmd_", "");
    const command = this.client.commands.get(cmdName);

    if (!command) {
      return await interaction.reply({
        content: `${EMOJIS.STATUS.ERROR} Command not found!`,
        flags: 64,
      });
    }

    const embed = HelpEmbedBuilder.createCommandDetailEmbed(
      command,
      this.client,
    );
    const backButton = HelpComponentBuilder.createBackButton();

    await interaction.update({
      embeds: [embed],
      components: [backButton],
    });
  }

  /**
   * Handle back to main help button
   * @param {import('discord.js').MessageComponentInteraction} interaction
   */
  async handleBackToMain(interaction) {
    const mainEmbed = HelpEmbedBuilder.createMainHelpEmbed(
      this.client,
      interaction.member,
    );
    const components = await HelpComponentBuilder.createMainComponents(
      interaction.member,
      this.client,
    );
    await interaction.update({
      embeds: [mainEmbed],
      components,
    });
  }

  /**
   * Handle interaction errors
   * @param {import('discord.js').MessageComponentInteraction} interaction
   * @param {Error} _error
   */
  async handleInteractionError(interaction, _error) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: `${EMOJIS.STATUS.ERROR} An error occurred while processing your request.`,
        flags: 64,
      });
    }
  }
}
