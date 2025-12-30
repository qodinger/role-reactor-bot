import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { THEME_COLOR, UI_COMPONENTS } from "../../../config/theme.js";
import { getDynamicHelpData } from "./data.js";
import { getLogger } from "../../../utils/logger.js";
import { ComponentBuilder } from "./components.js";

/**
 * Builder class for creating help embeds
 */
export class HelpEmbedBuilder {
  /**
   * Check if user has required permissions for a category
   * @param {import('discord.js').GuildMember} member
   * @param {string[]} requiredPermissions
   * @returns {Promise<boolean>}
   */
  static async hasCategoryPermissions(member, requiredPermissions) {
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permissions required
    }

    for (const permission of requiredPermissions) {
      if (permission === "DEVELOPER") {
        // Check if user is developer
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
   * Create the main help embed
   * @param {import('discord.js').Client} client
   * @returns {import('discord.js').EmbedBuilder}
   */
  static createMainHelpEmbed(client, _member = null) {
    const embed = new EmbedBuilder()
      .setAuthor(
        UI_COMPONENTS.createAuthor(
          `${client?.user?.username || "Role Reactor"} - Interactive Help`,
          client?.user?.displayAvatarURL() || null,
        ),
      )
      .setDescription(
        [
          `**Easy role management through reactions!**`,
          `Simple Setup • Beautiful UI • Instant Roles`,
          ``,
          `Use the dropdown to browse categories or the buttons to switch views.`,
        ].join("\n"),
      )
      .setColor(THEME_COLOR)
      .setThumbnail(client?.user?.displayAvatarURL() || null)
      .setTimestamp()
      .setFooter(
        UI_COMPONENTS.createFooter(
          `Serving ${client?.guilds?.cache?.size || 0} servers • Thanks for using Role Reactor!`,
          client?.user?.displayAvatarURL() || null,
        ),
      );

    // Quick start section
    try {
      embed.addFields({
        name: `Quick Start`,
        value: [
          `1. Use \`/role-reactions setup\` to create role selections`,
          `2. Members click reactions to get roles instantly`,
          `3. Use \`/temp-roles assign\` for time-limited access`,
          `4. Track everything with \`/temp-roles list\``,
        ].join("\n"),
        inline: false,
      });
    } catch {
      // Fall back silently if dynamic data unavailable
    }

    return embed;
  }

  /**
   * Create an embed showing all commands (first 25 due to Discord limits)
   * @param {import('discord.js').Client} client
   * @param {import('discord.js').GuildMember} member
   * @returns {Promise<import('discord.js').EmbedBuilder>}
   */
  static async createAllCommandsEmbed(client, member = null) {
    const embed = new EmbedBuilder()
      .setTitle(`All Commands`)
      .setColor(THEME_COLOR)
      .setTimestamp();

    try {
      const { COMMAND_METADATA, COMMAND_CATEGORIES } =
        await getDynamicHelpData(client);

      // Filter commands based on user permissions
      const allEntries = Object.entries(COMMAND_METADATA);
      const filtered = [];

      for (const [cmdName, _meta] of allEntries) {
        // If no member provided, show all commands (for backward compatibility)
        if (!member) {
          filtered.push([cmdName, _meta]);
          continue;
        }

        // Find the category this command belongs to using registry
        const category = Object.values(COMMAND_CATEGORIES).find(cat =>
          cat.commands.includes(cmdName),
        );

        if (!category) {
          // Show if no category found
          filtered.push([cmdName, _meta]);
          continue;
        }

        // Check if user has permissions for this category
        const hasPermissions = await ComponentBuilder.hasCategoryPermissions(
          member,
          category.requiredPermissions,
        );

        if (hasPermissions) {
          filtered.push([cmdName, _meta]);
        }
      }

      const all = filtered.sort((a, b) => a[0].localeCompare(b[0]));

      const shown = all.slice(0, 25);

      // Group into 5 fields with 5 commands each for readability
      const chunks = [];
      for (let i = 0; i < shown.length; i += 5) {
        chunks.push(shown.slice(i, i + 5));
      }

      chunks.forEach(chunk => {
        if (chunk.length === 0) return;
        const first = chunk[0][0];
        const last = chunk[chunk.length - 1][0];
        const label = `${first.substring(0, 1).toUpperCase()}–${last.substring(0, 1).toUpperCase()}`;
        const value = chunk
          .map(([cmdName, meta]) => {
            const lineMeta = meta || {};
            return `\`/${cmdName}\` — ${lineMeta?.shortDesc || "No description available"}`;
          })
          .join("\n\n");
        embed.addFields({ name: `Commands ${label}`, value, inline: false });
      });

      const total = all.length;
      embed.setFooter(
        UI_COMPONENTS.createFooter(
          `Showing ${Math.min(25, total)} of ${total} commands`,
          client?.user?.displayAvatarURL() || null,
        ),
      );
    } catch {
      // ignore
    }

    return embed;
  }

  /**
   * Build a summary string of popular commands
   * @param {Record<string, any>} metadata
   * @param {number} limit
   */
  static getTopCommandsSummary(metadata, limit = 5) {
    if (!metadata) return "";
    const commands = Object.entries(metadata)
      .slice(0, limit)
      .map(([name, _meta]) => `\`/${name}\``);
    return commands.join(" • ");
  }

  /**
   * Create category-specific embed
   * @param {string} categoryKey
   * @param {import('discord.js').Client} client
   * @returns {Promise<import('discord.js').EmbedBuilder|null>}
   */
  static async createCategoryEmbed(categoryKey, client) {
    if (categoryKey === "all") {
      return this.createMainHelpEmbed(client);
    }

    try {
      const { COMMAND_CATEGORIES } = await getDynamicHelpData(client);
      const category = COMMAND_CATEGORIES[categoryKey];
      if (!category) return null;

      const embed = new EmbedBuilder()
        .setTitle(`${category.name} Commands`)
        .setDescription(
          [
            category.description,
            "",
            `Showing **${category.commands.length}** command(s) in this category`,
          ].join("\n"),
        )
        .setColor(category.color)
        .setTimestamp()
        .setFooter(
          UI_COMPONENTS.createFooter(
            "Use the dropdown to switch categories",
            client?.user?.displayAvatarURL() || null,
          ),
        );

      // Add commands as fields
      const { COMMAND_METADATA } = await getDynamicHelpData(client);
      category.commands.forEach(cmdName => {
        const meta = COMMAND_METADATA[cmdName];
        if (meta) {
          embed.addFields({
            name: `\`/${cmdName}\``,
            value: meta.shortDesc,
            inline: false,
          });
        }
      });

      return embed;
    } catch (error) {
      const logger = getLogger();
      logger.error("Error creating category embed:", error);
      return null;
    }
  }

  /**
   * Create detailed command embed
   * @param {Object} command
   * @param {import('discord.js').Client} client
   * @returns {import('discord.js').EmbedBuilder}
   */
  static async createCommandDetailEmbed(command, client) {
    try {
      const embed = new EmbedBuilder()
        .setTitle(`/${command.data.name}`)
        .setDescription(command.data.description || "No description available.")
        .setColor(THEME_COLOR)
        .setTimestamp()
        .setFooter(
          UI_COMPONENTS.createFooter(
            "Role Reactor Help",
            client?.user?.displayAvatarURL() || null,
          ),
        );

      // Add command-specific help based on command name (now async)
      await this.addCommandSpecificHelp(embed, command.data.name, client);

      return embed;
    } catch (error) {
      const logger = getLogger();
      logger.error("Error creating command detail embed:", error);
      // Return a basic embed as fallback
      return new EmbedBuilder()
        .setTitle(`/${command.data.name}`)
        .setDescription(command.data.description || "No description available.")
        .setColor(THEME_COLOR)
        .setTimestamp();
    }
  }

  /**
   * Add command-specific help content
   * Dynamically loads helpFields from command metadata via the command registry
   * @param {import('discord.js').EmbedBuilder} embed
   * @param {string} commandName
   * @param {import('discord.js').Client} [client] - Discord client for registry access
   */
  static async addCommandSpecificHelp(embed, commandName, client = null) {
    // Try to load helpFields from command registry first (dynamic)
    if (client) {
      try {
        const { commandRegistry } = await import(
          "../../../utils/core/commandRegistry.js"
        );
        await commandRegistry.initialize(client);
        const helpFields = commandRegistry.getCommandHelpFields(commandName);

        if (helpFields && Array.isArray(helpFields) && helpFields.length > 0) {
          // Use dynamic helpFields from command metadata
          embed.addFields(helpFields);
          return;
        }
      } catch (error) {
        const logger = getLogger();
        logger.debug(
          `Failed to load helpFields from registry for ${commandName}:`,
          error,
        );
        // If helpFields can't be loaded, command will have no detailed help
        // This is acceptable - the embed will still show basic command info
      }
    }
  }
}
