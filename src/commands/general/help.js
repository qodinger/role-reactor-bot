import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { getLogger } from "../../utils/logger.js";
import { COMMAND_METADATA, COMMAND_CATEGORIES } from "./help/helpData.js";
import { HelpEmbedBuilder } from "./help/helpEmbedBuilder.js";
import { HelpComponentBuilder } from "./help/helpComponentBuilder.js";
import { HelpInteractionHandler } from "./help/helpInteractionHandler.js";
import { EMOJIS, THEME } from "../../config/theme.js";
import config from "../../config/config.js";

/**
 * Help command for providing interactive command information
 */
export default {
  /**
   * Find the category that contains a specific command
   * @param {string} commandName
   * @returns {Object|null}
   */
  findCommandCategory(commandName) {
    for (const [, category] of Object.entries(COMMAND_CATEGORIES)) {
      if (category.commands.includes(commandName)) {
        return category;
      }
    }
    return null;
  },

  /**
   * Check if user has required permissions for a category
   * @param {import('discord.js').GuildMember} member
   * @param {string[]} requiredPermissions
   * @returns {boolean}
   */
  hasCategoryPermissions(member, requiredPermissions) {
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permissions required
    }

    for (const permission of requiredPermissions) {
      if (permission === "DEVELOPER") {
        // Check if user is developer
        const developers = config.discord.developers;
        if (!developers || !developers.includes(member.user.id)) {
          return false;
        }
      } else {
        // Check Discord permissions
        const permissionFlag = PermissionFlagsBits[permission];
        if (permissionFlag && !member.permissions.has(permissionFlag)) {
          return false;
        }
      }
    }
    return true;
  },

  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription(
      `${EMOJIS.ACTIONS.HELP} Get interactive help and information about Role Reactor Bot`,
    )
    .addStringOption(option =>
      option
        .setName("command")
        .setDescription("Get detailed help for a specific command")
        .setRequired(false)
        .setAutocomplete(true),
    ),

  /**
   * Autocomplete handler for command suggestions
   * @param {import('discord.js').AutocompleteInteraction} interaction
   */
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const commands = Object.keys(COMMAND_METADATA);

    // Filter commands based on user permissions
    const accessibleCommands = commands.filter(cmd => {
      // Check if user has permission to access this command
      const category = this.findCommandCategory(cmd);
      if (!category) return true; // If no category found, allow access

      return this.hasCategoryPermissions(
        interaction.member,
        category.requiredPermissions,
      );
    });

    const filtered = accessibleCommands
      .filter(cmd => {
        const meta = COMMAND_METADATA[cmd];
        return (
          cmd.includes(focusedValue) ||
          meta.tags?.some(tag => tag.includes(focusedValue)) ||
          meta.shortDesc?.toLowerCase().includes(focusedValue)
        );
      })
      .slice(0, 25)
      .map(cmd => ({
        name: `${COMMAND_METADATA[cmd].emoji} ${cmd} - ${COMMAND_METADATA[cmd].shortDesc}`,
        value: cmd,
      }));

    await interaction.respond(filtered);
  },

  /**
   * Main command execution handler
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async execute(interaction, client) {
    const logger = getLogger();
    const command = interaction.options.getString("command");

    try {
      // Handle specific command help request
      if (command) {
        return await this.showCommandHelp(interaction, command, client);
      }

      // Create interactive help menu
      return await this.createInteractiveHelp(interaction, client);
    } catch (error) {
      logger.error("Error executing help command", error);
      await this.handleError(interaction, error);
    }
  },

  /**
   * Show help for a specific command
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {string} commandName
   * @param {import('discord.js').Client} client
   */
  async showCommandHelp(interaction, commandName, client) {
    const command = client.commands.get(commandName);

    if (!command) {
      return await interaction.reply({
        content: `${EMOJIS.STATUS.ERROR} Command not found!`,
        flags: 64,
      });
    }

    const embed = HelpEmbedBuilder.createCommandDetailEmbed(command, client);
    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },

  /**
   * Create the main interactive help interface
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('discord.js').Client} client
   */
  async createInteractiveHelp(interaction, client) {
    const embed = HelpEmbedBuilder.createMainHelpEmbed(
      client,
      interaction.member,
    );
    const components = HelpComponentBuilder.createMainComponents(
      interaction.member,
    );

    const response = await interaction.reply({
      embeds: [embed],
      components,
      flags: 64,
    });

    // Set up interaction collector
    const collector = response.createMessageComponentCollector({
      time: 300000, // 5 minutes
    });

    const interactionHandler = new HelpInteractionHandler(client);
    collector.on(
      "collect",
      interactionHandler.handleInteraction.bind(interactionHandler),
    );
    collector.on("end", () => this.handleCollectorEnd(interaction, components));
  },

  /**
   * Handle collector expiration
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {import('discord.js').ActionRowBuilder[]} components
   */
  async handleCollectorEnd(interaction, components) {
    const disabledComponents = components.map(row => {
      const disabledRow = new ActionRowBuilder();
      disabledRow.addComponents(
        ...row.components.map(component => {
          if (component instanceof StringSelectMenuBuilder) {
            return StringSelectMenuBuilder.from(component).setDisabled(true);
          } else if (component instanceof ButtonBuilder) {
            return ButtonBuilder.from(component).setDisabled(true);
          }
          return component;
        }),
      );
      return disabledRow;
    });

    try {
      await interaction.editReply({ components: disabledComponents });
    } catch (_error) {
      // Ignore errors if message was deleted
    }
  },

  /**
   * Handle errors in help command
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {Error} _error
   */
  async handleError(interaction, _error) {
    const errorEmbed = new EmbedBuilder()
      .setColor(THEME.ERROR)
      .setTitle(`${EMOJIS.STATUS.ERROR} Error`)
      .setDescription(
        "An error occurred while loading the help menu. Please try again.",
      )
      .setTimestamp();

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    } else {
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
