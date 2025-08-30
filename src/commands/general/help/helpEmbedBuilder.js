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
  static createMainHelpEmbed(client, _member = null) {
    const embed = new EmbedBuilder()
      .setAuthor(
        UI_COMPONENTS.createAuthor(
          `${client.user.username} - Interactive Help`,
          client.user.displayAvatarURL(),
        ),
      )
      .setDescription(
        [
          `${EMOJIS.FEATURES.ROLES} **Easy role management through reactions!**`,
          `🎯 **Simple Setup** • 🎨 **Beautiful UI** • ⚡ **Instant Roles**`,
          ``,
          `Use the dropdown to browse categories or the buttons to switch views.`,
        ].join("\n"),
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

    // Overview stats and quick start
    try {
      const { COMMAND_METADATA, COMMAND_CATEGORIES } =
        getDynamicHelpData(client);
      const totalCommands = Object.keys(COMMAND_METADATA).length;
      const totalCategories = Object.keys(COMMAND_CATEGORIES).length;
      const topCommands = HelpEmbedBuilder.getTopCommandsSummary(
        COMMAND_METADATA,
        6,
      );

      embed.addFields(
        {
          name: `${EMOJIS.STATUS.INFO} Overview`,
          value: [
            `Commands: **${totalCommands}** • Categories: **${totalCategories}**`,
            `Popular: ${topCommands || "N/A"}`,
          ].join("\n"),
          inline: false,
        },
        {
          name: `${EMOJIS.UI.MENU} Legend`,
          value: [
            `${EMOJIS.COMPLEXITY.EASY} Easy  ${EMOJIS.COMPLEXITY.MEDIUM} Medium  ${EMOJIS.COMPLEXITY.HARD} Hard`,
            `${EMOJIS.USAGE.HIGH} High usage  ${EMOJIS.USAGE.MEDIUM} Medium  ${EMOJIS.USAGE.LOW} Low`,
          ].join("\n"),
          inline: false,
        },
        {
          name: `${EMOJIS.ACTIONS.QUICK} Quick Start`,
          value: [
            `${EMOJIS.NUMBERS.ONE} Use \`/setup-roles\` to create role selections`,
            `${EMOJIS.NUMBERS.TWO} Members click reactions to get roles instantly`,
            `${EMOJIS.NUMBERS.THREE} Use \`/assign-temp-role\` for time-limited access`,
            `${EMOJIS.NUMBERS.FOUR} Track everything with \`/list-roles\``,
            `${EMOJIS.NUMBERS.FIVE} Schedule roles with \`/schedule-role\` for future events`,
            `${EMOJIS.NUMBERS.SIX} Create recurring schedules with \`/recurring-roles\``,
          ].join("\n"),
          inline: false,
        },
        {
          name: `${EMOJIS.FEATURES.EXPERIENCE} XP System Configuration`,
          value: [
            `${EMOJIS.STATUS.INFO} **XP system is disabled by default** and requires admin activation`,
            `${EMOJIS.NUMBERS.ONE} Use \`/xp-settings\` to view current XP system status`,
            `${EMOJIS.NUMBERS.TWO} Use the toggle buttons to enable/disable the XP system`,
            `${EMOJIS.NUMBERS.THREE} Toggle individual features: message XP, command XP, and role XP`,
            `${EMOJIS.NUMBERS.FOUR} All settings use default values optimized for most servers`,
            ``,
            `${EMOJIS.UI.INFO} **Default Settings:** Message XP (15-25), Command XP (8 base), Role XP (50), Cooldowns (60s/30s)`,
          ].join("\n"),
          inline: false,
        },
      );
    } catch {
      // Fall back silently if dynamic data unavailable
    }

    return embed;
  }

  /**
   * Create an embed showing all commands (first 25 due to Discord limits)
   * @param {import('discord.js').Client} client
   * @returns {import('discord.js').EmbedBuilder}
   */
  static createAllCommandsEmbed(client) {
    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.ACTIONS.SEARCH} All Commands`)
      .setColor(THEME_COLOR)
      .setTimestamp();

    try {
      const { COMMAND_METADATA } = getDynamicHelpData(client);
      const all = Object.entries(COMMAND_METADATA).sort((a, b) =>
        a[0].localeCompare(b[0]),
      );

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
            const complexity = lineMeta?.complexity || "";
            const usage = lineMeta?.usage || "";
            return `${lineMeta?.emoji || EMOJIS.ACTIONS.HELP} \`/${cmdName}\` — ${lineMeta?.shortDesc || "No description available"}\n${getComplexityIndicator(complexity)} ${complexity} • ${getUsageIndicator(usage)} ${usage}`;
          })
          .join("\n\n");
        embed.addFields({ name: `Commands ${label}`, value, inline: true });
      });

      const total = all.length;
      embed.setFooter(
        UI_COMPONENTS.createFooter(
          `Showing ${Math.min(25, total)} of ${total} commands`,
          client.user.displayAvatarURL(),
        ),
      );
    } catch {
      // ignore
    }

    return embed;
  }

  /**
   * Build a summary string of top commands by usage
   * @param {Record<string, any>} metadata
   * @param {number} limit
   */
  static getTopCommandsSummary(metadata, limit = 5) {
    if (!metadata) return "";
    const weight = v =>
      v?.toLowerCase?.() === "high"
        ? 3
        : v?.toLowerCase?.() === "medium"
          ? 2
          : 1;
    const sorted = Object.entries(metadata)
      .sort((a, b) => weight(b[1]?.usage) - weight(a[1]?.usage))
      .slice(0, limit)
      .map(
        ([name, meta]) => `${meta?.emoji || EMOJIS.ACTIONS.HELP} \`/${name}\``,
      );
    return sorted.join(" • ");
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

      case "schedule-role":
        embed.addFields(
          {
            name: `${EMOJIS.ACTIONS.ADD} ⏰ How to Use`,
            value:
              '```/schedule-role users:"@user1,@user2" role:@EventRole schedule_time:"tomorrow 9am" duration:"2h" reason:"Morning event"```',
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 What You Need`,
            value: [
              "**users** - The members to assign the role to (can be multiple)",
              "**role** - The role to assign temporarily",
              "**schedule_time** - When to assign the role (e.g., 'tomorrow 9am', 'next friday 6pm', 'in 2 hours')",
              "**duration** - How long the role should last (like 30m, 2h, 1d, 1w)",
              "**reason** *(optional)* - Why you're scheduling this role",
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
            name: `${EMOJIS.TIME.TIMER} ⏱️ Schedule Examples`,
            value: [
              "`tomorrow 9am` - Next day at 9 AM",
              "`next friday 6pm` - Next Friday at 6 PM",
              "`in 2 hours` - 2 hours from now",
              "`2024-01-15 14:30` - Specific date and time",
              "`9am` - Today at 9 AM (if not passed)",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 🎉 Perfect For`,
            value:
              "Events, tournaments, meetings, scheduled maintenance, or any future role assignments!",
            inline: false,
          },
        );
        break;

      case "recurring-roles":
        embed.addFields(
          {
            name: `${EMOJIS.ACTIONS.ADD} 🔄 How to Use`,
            value:
              '```/recurring-roles create users:"@user1,@user2" role:@WeeklyRole schedule_type:weekly schedule_details:"monday 9am" duration:"1d" reason:"Weekly meeting"```',
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 What You Need`,
            value: [
              "**users** - The members to assign the role to (can be multiple)",
              "**role** - The role to assign on schedule",
              "**schedule_type** - Daily, weekly, monthly, or custom interval",
              "**schedule_details** - Specific schedule details (e.g., '9am', 'monday 6pm', '15 2pm', '120')",
              "**duration** - How long each role assignment should last",
              "**reason** *(optional)* - Why you're creating this recurring schedule",
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
            name: `${EMOJIS.TIME.TIMER} ⏱️ Schedule Examples`,
            value: [
              "**Daily:** `9am` - Every day at 9 AM",
              "**Weekly:** `monday 6pm` - Every Monday at 6 PM",
              "**Monthly:** `15 2pm` - 15th of each month at 2 PM",
              "**Custom:** `120` - Every 120 minutes (2 hours)",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 🎉 Perfect For`,
            value:
              "Weekly meetings, daily check-ins, monthly events, or any recurring role assignments!",
            inline: false,
          },
        );
        break;

      case "scheduled-roles":
        embed.addFields(
          {
            name: `${EMOJIS.ACTIONS.VIEW} 📋 How to Use`,
            value: "```/scheduled-roles list```",
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 What You Need`,
            value: [
              "**list** - View all scheduled and recurring roles",
              "**view** - Get detailed information about a specific schedule",
              "**cancel** - Cancel a scheduled or recurring role",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} 🔐 Permissions`,
            value: "• **Manage Roles** permission required",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value: [
              "Overview of all scheduled and recurring role assignments with:",
              "• Schedule IDs, roles, and timing information",
              "• Status updates (pending, completed, failed)",
              "• Next run times for recurring schedules",
              "• Ability to view details or cancel schedules",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 💡 Quick Actions`,
            value: [
              "Use `/scheduled-roles view <id>` to see detailed information",
              "Use `/scheduled-roles cancel <id>` to cancel unwanted schedules",
              "Monitor the status of all your scheduled role assignments",
            ].join("\n"),
            inline: false,
          },
        );
        break;

      case "xp-settings":
        embed.addFields(
          {
            name: `${EMOJIS.FEATURES.EXPERIENCE} 📊 How to Use`,
            value: "```/xp-settings```",
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 What You Need`,
            value: "No parameters needed - just run the command!",
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} 🔐 Permissions`,
            value: "• **Manage Guild** permission required",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value: [
              "Current XP system status with interactive buttons to:",
              "• Toggle the entire XP system on/off",
              "• Enable/disable message XP, command XP, and role XP individually",
              "• View current XP amounts, cooldowns, and settings",
              "• Access configuration help",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 💡 Quick Actions`,
            value: [
              "Use the buttons to quickly toggle features on/off",
              "All changes are applied immediately",
              "Settings use optimized default values",
            ].join("\n"),
            inline: false,
          },
        );
        break;
    }
  }
}
