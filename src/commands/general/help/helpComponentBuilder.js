import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { COMMAND_CATEGORIES } from "./helpData.js";
import { EMOJIS } from "../../../config/theme.js";
import config from "../../../config/config.js";

/**
 * Builder class for creating help UI components
 */
export class HelpComponentBuilder {
  /**
   * Check if user has required permissions for a category
   * @param {import('discord.js').GuildMember} member
   * @param {string[]} requiredPermissions
   * @returns {boolean}
   */
  static hasCategoryPermissions(member, requiredPermissions) {
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
  }

  /**
   * Create main components for the help interface
   * @param {import('discord.js').GuildMember} member
   * @returns {import('discord.js').ActionRowBuilder[]}
   */
  static createMainComponents(member = null) {
    const categoryMenu = this.createCategoryMenu(member);
    const buttons = this.createCommandButtons();

    const menuRow = new ActionRowBuilder().addComponents(categoryMenu);
    return [menuRow, buttons];
  }

  /**
   * Create interactive category selection menu
   * @param {import('discord.js').GuildMember} member
   * @returns {import('discord.js').StringSelectMenuBuilder}
   */
  static createCategoryMenu(member = null) {
    const options = Object.entries(COMMAND_CATEGORIES)
      .filter(([_key, category]) => {
        // If no member provided, show all categories (for backward compatibility)
        if (!member) return true;

        // Check if user has permissions for this category
        return this.hasCategoryPermissions(
          member,
          category.requiredPermissions,
        );
      })
      .map(([key, category]) => ({
        label: category.name,
        description: category.description,
        value: `category_${key}`,
        emoji: category.emoji,
      }));

    return new StringSelectMenuBuilder()
      .setCustomId("help_category_select")
      .setPlaceholder(`${EMOJIS.ACTIONS.SEARCH} Choose a command category...`)
      .addOptions(options);
  }

  /**
   * Create command-specific navigation buttons
   * @param {string|null} category
   * @returns {import('discord.js').ActionRowBuilder}
   */
  static createCommandButtons(_category = null) {
    const row = new ActionRowBuilder();

    // External links
    row.addComponents(
      new ButtonBuilder()
        .setLabel("Guide")
        .setURL(
          "https://github.com/tyecode-bots/role-reactor-bot/blob/main/README.md",
        )
        .setEmoji(EMOJIS.CATEGORIES.GENERAL)
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel("GitHub")
        .setURL("https://github.com/tyecode-bots/role-reactor-bot")
        .setEmoji(EMOJIS.ACTIONS.LINK)
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel("Support")
        .setURL("https://discord.gg/rolereactor")
        .setEmoji(EMOJIS.STATUS.INFO)
        .setStyle(ButtonStyle.Link),
    );

    return row;
  }

  /**
   * Create back button for command detail view
   * @returns {import('discord.js').ActionRowBuilder}
   */
  static createBackButton() {
    const row = new ActionRowBuilder();
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("help_back_main")
        .setLabel("Back to Help")
        .setEmoji(EMOJIS.ACTIONS.BACK)
        .setStyle(ButtonStyle.Secondary),
    );
    return row;
  }

  /**
   * Create components for category view
   * @param {string} categoryKey
   * @param {import('discord.js').GuildMember} member
   * @returns {import('discord.js').ActionRowBuilder[]}
   */
  static createCategoryComponents(categoryKey, member = null) {
    const categoryMenu = this.createCategoryMenu(member);
    const buttons = this.createCommandButtons(categoryKey);

    const menuRow = new ActionRowBuilder().addComponents(categoryMenu);
    return [menuRow, buttons];
  }
}
