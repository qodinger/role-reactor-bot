import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { getDynamicHelpData } from "./data.js";
import { EMOJIS } from "../../../config/theme.js";
import config from "../../../config/config.js";
import { getLogger } from "../../../utils/logger.js";
import { getDefaultInviteLink } from "../../../utils/discord/invite.js";

/**
 * Builder class for creating help UI components
 */
export class ComponentBuilder {
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
   * @param {import('discord.js').Client} [client]
   * @returns {Promise<import('discord.js').ActionRowBuilder[]>}
   */
  static async createMainComponents(member = null, client = null) {
    const categoryMenu = this.createCategoryMenu(member, client);
    const buttons = await this.createCommandButtons(null, client);
    const viewToggles = this.createViewToggleButtons();

    const rows = [];
    rows.push(new ActionRowBuilder().addComponents(categoryMenu));
    if (viewToggles) rows.push(viewToggles);
    if (buttons) rows.push(buttons);
    return rows;
  }

  /**
   * Create interactive category selection menu
   * @param {import('discord.js').GuildMember} member
   * @returns {import('discord.js').StringSelectMenuBuilder}
   */
  static createCategoryMenu(member = null, client = null) {
    try {
      const { COMMAND_CATEGORIES } = getDynamicHelpData(client);
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
    } catch (error) {
      const logger = getLogger();
      logger.error("Error creating category menu:", error);
      // Fallback to basic menu
      return new StringSelectMenuBuilder()
        .setCustomId("help_category_select")
        .setPlaceholder(`${EMOJIS.ACTIONS.SEARCH} Choose a command category...`)
        .addOptions([
          {
            label: "General",
            description: "Basic bot information and help",
            value: "category_general",
            emoji: EMOJIS.CATEGORIES.GENERAL,
          },
        ]);
    }
  }

  /**
   * Create view toggle buttons (Overview / All Commands)
   * @returns {import('discord.js').ActionRowBuilder}
   */
  static createViewToggleButtons() {
    const row = new ActionRowBuilder();
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("help_view_overview")
        .setLabel("Overview")
        .setEmoji(EMOJIS.STATUS.INFO)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("help_view_all")
        .setLabel("All Commands")
        .setEmoji(EMOJIS.ACTIONS.SEARCH)
        .setStyle(ButtonStyle.Secondary),
    );
    return row;
  }

  /**
   * Create command buttons for help UI
   * @param {string} category
   * @param {import('discord.js').Client} client
   * @returns {Promise<import('discord.js').ActionRowBuilder>}
   */
  static async createCommandButtons(_category = null, client = null) {
    const row = new ActionRowBuilder();

    // Determine invite link
    let inviteURL = null;
    if (client) {
      inviteURL = client.inviteLink;
      if (!inviteURL) {
        try {
          inviteURL = await getDefaultInviteLink(client);
        } catch {
          inviteURL = null;
        }
      }
    }

    // External links
    const buttons = [];
    const links = config.externalLinks;
    if (links.guide) {
      buttons.push(
        new ButtonBuilder()
          .setLabel("Guide")
          .setURL(links.guide)
          .setEmoji(EMOJIS.CATEGORIES.GENERAL)
          .setStyle(ButtonStyle.Link),
      );
    }
    if (links.github) {
      buttons.push(
        new ButtonBuilder()
          .setLabel("GitHub")
          .setURL(links.github)
          .setEmoji(EMOJIS.ACTIONS.LINK)
          .setStyle(ButtonStyle.Link),
      );
    }
    if (links.support) {
      buttons.push(
        new ButtonBuilder()
          .setLabel("Support")
          .setURL(links.support)
          .setEmoji(EMOJIS.STATUS.INFO)
          .setStyle(ButtonStyle.Link),
      );
    }
    if (inviteURL) {
      buttons.push(
        new ButtonBuilder()
          .setLabel("Invite")
          .setURL(inviteURL)
          .setEmoji(EMOJIS.ACTIONS.LINK)
          .setStyle(ButtonStyle.Link),
      );
    }
    if (buttons.length === 0) {
      return undefined;
    }
    row.addComponents(...buttons);

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
   * @param {import('discord.js').Client} [client]
   * @returns {Promise<import('discord.js').ActionRowBuilder[]>}
   */
  static async createCategoryComponents(
    categoryKey,
    member = null,
    client = null,
  ) {
    const categoryMenu = this.createCategoryMenu(member, client);
    const buttons = await this.createCommandButtons(categoryKey, client);
    const viewToggles = this.createViewToggleButtons();

    const rows = [];
    rows.push(new ActionRowBuilder().addComponents(categoryMenu));
    if (viewToggles) rows.push(viewToggles);
    if (buttons) rows.push(buttons);
    return rows;
  }
}
