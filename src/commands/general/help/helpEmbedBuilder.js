import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { THEME_COLOR, EMOJIS, UI_COMPONENTS } from "../../../config/theme.js";
import {
  getDynamicHelpData,
  getComplexityIndicator,
  getUsageIndicator,
} from "./helpData.js";
import config from "../../../config/config.js";

/**
 * Builder class for creating help embeds
 */
export class HelpEmbedBuilder {
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
   * Create the main help embed
   * @param {import('discord.js').Client} client
   * @returns {import('discord.js').EmbedBuilder}
   */
  static createMainHelpEmbed(client) {
    const embed = new EmbedBuilder()
      .setAuthor(
        UI_COMPONENTS.createAuthor(
          `${client.user.username} - Interactive Help`,
          client.user.displayAvatarURL(),
        ),
      )
      .setDescription(
        `${EMOJIS.FEATURES.ROLES} **Easy role management through reactions!**\n\n` +
          `🎯 **Simple Setup** • 🎨 **Beautiful UI** • ⚡ **Instant Roles**\n\n` +
          `Use the **dropdown menu** below to explore commands!`,
      )
      .setColor(THEME_COLOR)
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter(
        UI_COMPONENTS.createFooter(
          `Serving ${client.guilds.cache.size} servers • Thanks for using Role Reactor!`,
          client.user.displayAvatarURL(),
        ),
      );

    // Quick Start Guide
    embed.addFields({
      name: `${EMOJIS.ACTIONS.QUICK} Quick Start`,
      value: [
        `${EMOJIS.NUMBERS.ONE} Use \`/setup-roles\` to create role selections`,
        `${EMOJIS.NUMBERS.TWO} Members click reactions to get roles instantly`,
        `${EMOJIS.NUMBERS.THREE} Use \`/assign-temp-role\` for time-limited access`,
        `${EMOJIS.NUMBERS.FOUR} Track everything with \`/list-roles\``,
      ].join("\n"),
      inline: false,
    });

    // Key Features
    embed.addFields({
      name: `${EMOJIS.STATUS.SUCCESS} Key Features`,
      value: [
        `${EMOJIS.FEATURES.ROLES} **One-Click Roles** - Instant role assignment`,
        `${EMOJIS.FEATURES.TEMPORARY} **Event Roles** - Perfect for tournaments and giveaways`,
        `${EMOJIS.FEATURES.SECURITY} **Safe & Secure** - Admin-only management`,
        `${EMOJIS.FEATURES.MONITORING} **Always Online** - Built-in monitoring`,
      ].join("\n"),
      inline: false,
    });

    return embed;
  }

  /**
   * Create category-specific embed
   * @param {string} categoryKey
   * @param {import('discord.js').Client} client
   * @returns {import('discord.js').EmbedBuilder|null}
   */
  static createCategoryEmbed(categoryKey, client) {
    if (categoryKey === "all") {
      return this.createMainHelpEmbed(client);
    }

    try {
      const { COMMAND_CATEGORIES } = getDynamicHelpData(client);
      const category = COMMAND_CATEGORIES[categoryKey];
      if (!category) return null;

      const embed = new EmbedBuilder()
        .setTitle(`${category.emoji} ${category.name} Commands`)
        .setDescription(category.description)
        .setColor(category.color)
        .setTimestamp()
        .setFooter(
          UI_COMPONENTS.createFooter(
            "Use the dropdown to switch categories",
            client.user.displayAvatarURL(),
          ),
        );

      // Add commands as fields
      const { COMMAND_METADATA } = getDynamicHelpData(client);
      category.commands.forEach(cmdName => {
        const meta = COMMAND_METADATA[cmdName];
        if (meta) {
          embed.addFields({
            name: `${meta.emoji} \`/${cmdName}\``,
            value: `${meta.shortDesc}\n${getComplexityIndicator(meta.complexity)} ${meta.complexity} • ${getUsageIndicator(meta.usage)} ${meta.usage}`,
            inline: true,
          });
        }
      });

      return embed;
    } catch (error) {
      console.error("Error creating category embed:", error);
      return null;
    }
  }

  /**
   * Create detailed command embed
   * @param {Object} command
   * @param {import('discord.js').Client} client
   * @returns {import('discord.js').EmbedBuilder}
   */
  static createCommandDetailEmbed(command, client) {
    try {
      const { COMMAND_METADATA } = getDynamicHelpData(client);
      const meta = COMMAND_METADATA[command.data.name];
      const embed = new EmbedBuilder()
        .setTitle(`${meta?.emoji || EMOJIS.ACTIONS.HELP} /${command.data.name}`)
        .setDescription(command.data.description || "No description available.")
        .setColor(THEME_COLOR)
        .setTimestamp()
        .setFooter(
          UI_COMPONENTS.createFooter(
            "Role Reactor Help",
            client.user.displayAvatarURL(),
          ),
        );

      // Add command metadata
      if (meta) {
        embed.addFields({
          name: `${EMOJIS.FEATURES.MONITORING} 📊 Command Info`,
          value: [
            `**Complexity:** ${getComplexityIndicator(meta.complexity)} ${meta.complexity}`,
            `**Usage:** ${getUsageIndicator(meta.usage)} ${meta.usage}`,
            `**Tags:** ${meta.tags?.map(tag => `\`${tag}\``).join(", ") || "None"}`,
          ].join("\n"),
          inline: false,
        });
      }

      // Add command-specific help based on command name
      this.addCommandSpecificHelp(embed, command.data.name);

      return embed;
    } catch (error) {
      console.error("Error creating command detail embed:", error);
      // Return a basic embed as fallback
      return new EmbedBuilder()
        .setTitle(`${EMOJIS.ACTIONS.HELP} /${command.data.name}`)
        .setDescription(command.data.description || "No description available.")
        .setColor(THEME_COLOR)
        .setTimestamp();
    }
  }

  /**
   * Add command-specific help content
   * @param {import('discord.js').EmbedBuilder} embed
   * @param {string} commandName
   */
  static addCommandSpecificHelp(embed, commandName) {
    switch (commandName) {
      case "setup-roles":
        embed.addFields(
          {
            name: `${EMOJIS.ACTIONS.EDIT} Usage`,
            value:
              '```/setup-roles title:"Choose Your Roles!" description:"Pick the roles that interest you!" roles:"🎮:Gamer,🎨:Artist,💻:Developer" color:"#0099ff"```',
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} Parameters`,
            value: [
              "**title** - Title for your role selection message",
              "**description** - Text explaining what members should do",
              "**roles** - Roles with emojis (format: `emoji:role,emoji:role`)",
              "**color** *(optional)* - Color for the message (like `#0099ff`)",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} Permissions`,
            value:
              "• **Manage Roles** permission (for you)\n• **Manage Messages** permission (for the bot)\n• **Add Reactions** permission (for the bot)",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} Examples`,
            value: [
              "`🎮:Gamer,🎨:Artist,💻:Developer` - Gaming community roles",
              "`<:verified:123456789>:Verified,<:moderator:987654321>:Moderator` - Custom emoji roles",
              "`🎵:Music Lover,📚:Book Club,🏃:Fitness` - Interest-based roles",
            ].join("\n"),
            inline: false,
          },
        );
        break;

      case "update-roles":
        embed.addFields(
          {
            name: `${EMOJIS.ACTIONS.EDIT} Usage`,
            value:
              '```/update-roles message_id:123456789012345678 title:"Updated Roles!" roles:"🎮:Gamer,🎨:Artist" color:"#ff0000"```',
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} Parameters`,
            value: [
              "**message_id** - ID of the role message to change (get from `/list-roles`)",
              "**title** *(optional)* - New title for your role message",
              "**description** *(optional)* - Updated description text",
              "**roles** *(optional)* - New roles with emojis",
              "**color** *(optional)* - New color for the message",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} Permissions`,
            value:
              "• **Manage Roles** permission (for you)\n• **Manage Messages** permission (for the bot)",
            inline: false,
          },
        );
        break;

      case "delete-roles":
        embed.addFields(
          {
            name: `${EMOJIS.ACTIONS.DELETE} Usage`,
            value: "```/delete-roles message_id:123456789012345678```",
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} Parameters`,
            value:
              "**message_id** - ID of the role message to remove (get from `/list-roles`)",
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} Permissions`,
            value:
              "• **Manage Roles** permission (for you)\n• **Manage Messages** permission (for the bot)",
            inline: false,
          },
        );
        break;

      case "list-roles":
        embed.addFields(
          {
            name: `${EMOJIS.ACTIONS.VIEW} 📋 How to Use`,
            value: "```/list-roles```",
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 What You Need`,
            value: "No parameters needed - just run the command!",
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} 🔐 Permissions`,
            value: "• **Manage Roles** permission (for you)",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value:
              "A list of all your active role selection messages with their titles, message IDs, and which channels they're in. Perfect for keeping track of your community's role system!",
            inline: false,
          },
        );
        break;

      case "assign-temp-role":
        embed.addFields(
          {
            name: `${EMOJIS.ACTIONS.ADD} ⏰ How to Use`,
            value:
              '```/assign-temp-role users:"@user1,@user2" role:@EventRole duration:"2h" reason:"Tournament participation"```',
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 What You Need`,
            value: [
              "**users** - The members you want to give the temporary role to (can be multiple)",
              "**role** - The role you want to assign temporarily",
              "**duration** - How long the role should last (like 30m, 2h, 1d, 1w)",
              "**reason** *(optional)* - Why you're giving this temporary role",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} 🔐 Permissions`,
            value:
              "• **Manage Roles** permission (for you)\n• **Manage Roles** permission (for the bot)",
            inline: false,
          },
          {
            name: `${EMOJIS.TIME.TIMER} ⏱️ Time Examples`,
            value: [
              "`30m` - 30 minutes (perfect for quick events)",
              "`2h` - 2 hours (great for tournaments)",
              "`1d` - 1 day (good for day-long events)",
              "`1w` - 1 week (for longer special access)",
              "`1h30m` - 1 hour 30 minutes (flexible timing)",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 🎉 Perfect For`,
            value:
              "Events, tournaments, giveaways, VIP access, beta testing, or any temporary special access!",
            inline: false,
          },
        );
        break;

      case "list-temp-roles":
        embed.addFields(
          {
            name: `${EMOJIS.ACTIONS.VIEW} 📋 How to Use`,
            value: "```/list-temp-roles [user:@username]```",
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 What You Need`,
            value: [
              "**user** *(optional)* - Check a specific member's temporary roles (leave empty to see all)",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} 🔐 Permissions`,
            value: "• **Manage Roles** permission (for you)",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value:
              "A list of all temporary roles with when they expire and how much time is left. Great for keeping track of event access and special permissions!",
            inline: false,
          },
        );
        break;

      case "remove-temp-role":
        embed.addFields(
          {
            name: `${EMOJIS.ACTIONS.REMOVE} 🗑️ How to Use`,
            value:
              '```/remove-temp-role user:@username role:@EventRole reason:"Event ended early"```',
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 What You Need`,
            value: [
              "**user** - The member you want to remove the temporary role from",
              "**role** - The temporary role you want to remove",
              "**reason** *(optional)* - Why you're removing the role early",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} 🔐 Permissions`,
            value:
              "• **Manage Roles** permission (for you)\n• **Manage Roles** permission (for the bot)",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} ⚠️ Important Note`,
            value:
              "This only works on temporary roles that were assigned through the bot. Regular roles need to be removed manually.",
            inline: false,
          },
        );
        break;

      case "help":
        embed.addFields(
          {
            name: `${EMOJIS.ACTIONS.HELP} ❓ How to Use`,
            value: "```/help [command]```",
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 What You Need`,
            value:
              "**command** *(optional)* - Get detailed help for a specific command",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value:
              "Detailed instructions, examples, and everything you need to know about using the bot effectively!",
            inline: false,
          },
        );
        break;

      case "health":
        embed.addFields(
          {
            name: `${EMOJIS.STATUS.SUCCESS} 💚 How to Use`,
            value: "```/health```",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value:
              "Bot uptime, memory usage, server count, and overall health status - perfect for checking if everything is running smoothly!",
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} 🔐 Who Can Use`,
            value: "• Developer only",
            inline: false,
          },
        );
        break;

      case "performance":
        embed.addFields(
          {
            name: `${EMOJIS.FEATURES.MONITORING} 📊 How to Use`,
            value: "```/performance```",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value:
              "Command usage statistics, event processing metrics, and performance data - great for understanding how your community uses the bot!",
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} 🔐 Who Can Use`,
            value: "• Developer only",
            inline: false,
          },
        );
        break;

      case "storage":
        embed.addFields(
          {
            name: `${EMOJIS.FEATURES.BACKUP} 💾 How to Use`,
            value: "```/storage```",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value:
              "Database connection status, local file storage info, and sync status - ensures your role data is safe and backed up!",
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} 🔐 Who Can Use`,
            value: "• Developer only",
            inline: false,
          },
        );
        break;

      case "invite":
        embed.addFields(
          {
            name: `${EMOJIS.ACTIONS.LINK} How to Use`,
            value: "```/invite```",
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 What You Need`,
            value: "No parameters needed - just run the command!",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value:
              "An invite link to add Role Reactor Bot to your server. The link is sent as an ephemeral message, so only you can see it. Share it with others to invite the bot!",
            inline: false,
          },
        );
        break;
    }
  }
}
