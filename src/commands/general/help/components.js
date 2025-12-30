import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { getDynamicHelpData } from "./data.js";
import { EMOJIS } from "../../../config/theme.js";
import { getLogger } from "../../../utils/logger.js";

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
  static async hasCategoryPermissions(member, requiredPermissions) {
    if (!member || !requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permissions required
    }

    // Check if member has required properties
    if (!member.user || !member.permissions) {
      return true; // Default to true if member data is incomplete
    }

    for (const permission of requiredPermissions) {
      if (permission === "DEVELOPER") {
        // Check if user is developer (use isDeveloper from permissions.js)
        const { isDeveloper } = await import(
          "../../../utils/discord/permissions.js"
        );
        if (!isDeveloper(member.user.id)) {
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
    const categoryMenu = await this.createCategoryMenu(member, client);
    const buttons = await this.createCommandButtons(null, client);
    const viewToggles = await this.createViewToggleButtons();

    const rows = [];
    rows.push(new ActionRowBuilder().addComponents(categoryMenu));
    if (viewToggles) rows.push(viewToggles);
    if (buttons) rows.push(buttons);
    return rows;
  }

  /**
   * Create interactive category selection menu
   * @param {import('discord.js').GuildMember} member
   * @param {import('discord.js').Client} client
   * @param {string} selectedCategory - Currently selected category key
   * @returns {Promise<import('discord.js').StringSelectMenuBuilder>}
   */
  static async createCategoryMenu(
    member = null,
    client = null,
    selectedCategory = null,
  ) {
    try {
      const { COMMAND_CATEGORIES } = await getDynamicHelpData(client);

      const options = [];
      for (const [key, category] of Object.entries(COMMAND_CATEGORIES)) {
        // If no member provided, show all categories (for backward compatibility)
        if (!member) {
          options.push({
            label: category.name,
            description: category.description,
            value: `category_${key}`,
            emoji: category.emoji,
            default: selectedCategory === key,
          });
          continue;
        }

        // Check if user has permissions for this category
        const hasPermissions = await this.hasCategoryPermissions(
          member,
          category.requiredPermissions,
        );

        if (hasPermissions) {
          options.push({
            label: category.name,
            description: category.description,
            value: `category_${key}`,
            emoji: category.emoji,
            default: selectedCategory === key,
          });
        }
      }

      return new StringSelectMenuBuilder()
        .setCustomId("help_category_select")
        .setPlaceholder(`Choose a command category...`)
        .addOptions(options);
    } catch (error) {
      const logger = getLogger();
      logger.error("Error creating category menu:", error);
      // Fallback to basic menu
      return new StringSelectMenuBuilder()
        .setCustomId("help_category_select")
        .setPlaceholder(`Choose a command category...`)
        .addOptions([
          {
            label: "General",
            description: "Basic bot information and help",
            value: "category_general",
            emoji: EMOJIS.CATEGORIES.GENERAL,
            default: selectedCategory === "general",
          },
        ]);
    }
  }

  /**
   * Create view toggle buttons (Overview / All Commands)
   * @returns {import('discord.js').ActionRowBuilder}
   */
  static async createViewToggleButtons() {
    const row = new ActionRowBuilder();

    // Internal buttons
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("help_view_overview")
        .setLabel("Overview")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("help_view_all")
        .setLabel("All Commands")
        .setStyle(ButtonStyle.Secondary),
    );

    // Load config dynamically for external links
    let links = {
      guide: process.env.GUIDE_URL || null,
      github: process.env.GITHUB_REPO_URL || null,
    };
    try {
      const configModule = await import("../../../config/config.js").catch(
        () => null,
      );
      const config =
        configModule?.config || configModule?.default || configModule || {};
      links = config.externalLinks || links;
    } catch {
      // Use environment variables or defaults
    }

    // External link buttons
    if (links.guide) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel("Guide")
          .setURL(links.guide)
          .setStyle(ButtonStyle.Link),
      );
    }
    if (links.github) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel("GitHub")
          .setURL(links.github)
          .setStyle(ButtonStyle.Link),
      );
    }

    return row;
  }

  /**
   * Create command buttons for help UI
   * @param {string} category
   * @param {import('discord.js').Client} client
   * @returns {Promise<import('discord.js').ActionRowBuilder>}
   */
  static async createCommandButtons(_category = null, _client = null) {
    // No longer needed - buttons moved to createViewToggleButtons
    return undefined;
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
    const categoryMenu = await this.createCategoryMenu(
      member,
      client,
      categoryKey,
    );
    const buttons = await this.createCommandButtons(categoryKey, client);
    const viewToggles = await this.createViewToggleButtons();

    const rows = [];
    rows.push(new ActionRowBuilder().addComponents(categoryMenu));
    if (viewToggles) rows.push(viewToggles);
    if (buttons) rows.push(buttons);
    return rows;
  }
}
