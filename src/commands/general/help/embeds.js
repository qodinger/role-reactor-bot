import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { THEME_COLOR, EMOJIS, UI_COMPONENTS } from "../../../config/theme.js";
import { getDynamicHelpData } from "./data.js";
import config from "../../../config/config.js";
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
          `${client?.user?.username || "Role Reactor"} - Interactive Help`,
          client?.user?.displayAvatarURL() || null,
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
      .setThumbnail(client?.user?.displayAvatarURL() || null)
      .setTimestamp()
      .setFooter(
        UI_COMPONENTS.createFooter(
          `Serving ${client?.guilds?.cache?.size || 0} servers • Thanks for using Role Reactor!`,
          client?.user?.displayAvatarURL() || null,
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
          name: `${EMOJIS.ACTIONS.QUICK} Quick Start`,
          value: [
            `${EMOJIS.NUMBERS.ONE} Use \`/role-reactions setup\` to create role selections`,
            `${EMOJIS.NUMBERS.TWO} Members click reactions to get roles instantly`,
            `${EMOJIS.NUMBERS.THREE} Use \`/temp-roles assign\` for time-limited access`,
            `${EMOJIS.NUMBERS.FOUR} Track everything with \`/temp-roles list\``,
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
   * @param {import('discord.js').GuildMember} member
   * @returns {import('discord.js').EmbedBuilder}
   */
  static createAllCommandsEmbed(client, member = null) {
    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.ACTIONS.SEARCH} All Commands`)
      .setColor(THEME_COLOR)
      .setTimestamp();

    try {
      const { COMMAND_METADATA, COMMAND_CATEGORIES } =
        getDynamicHelpData(client);

      // Filter commands based on user permissions
      const all = Object.entries(COMMAND_METADATA)
        .filter(([cmdName, _meta]) => {
          // If no member provided, show all commands (for backward compatibility)
          if (!member) return true;

          // Find the category this command belongs to
          const category = Object.values(COMMAND_CATEGORIES).find(cat =>
            cat.commandPatterns.some(pattern =>
              cmdName.toLowerCase().includes(pattern.toLowerCase()),
            ),
          );

          if (!category) return true; // Show if no category found

          // Check if user has permissions for this category
          return ComponentBuilder.hasCategoryPermissions(
            member,
            category.requiredPermissions,
          );
        })
        .sort((a, b) => a[0].localeCompare(b[0]));

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
            return `${lineMeta?.emoji || EMOJIS.ACTIONS.HELP} \`/${cmdName}\` — ${lineMeta?.shortDesc || "No description available"}`;
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
      .map(
        ([name, meta]) => `${meta?.emoji || EMOJIS.ACTIONS.HELP} \`/${name}\``,
      );
    return commands.join(" • ");
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
            client?.user?.displayAvatarURL() || null,
          ),
        );

      // Add commands as fields
      const { COMMAND_METADATA } = getDynamicHelpData(client);
      category.commands.forEach(cmdName => {
        const meta = COMMAND_METADATA[cmdName];
        if (meta) {
          embed.addFields({
            name: `${meta.emoji} \`/${cmdName}\``,
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
            client?.user?.displayAvatarURL() || null,
          ),
        );

      // Add command-specific help based on command name
      this.addCommandSpecificHelp(embed, command.data.name);

      return embed;
    } catch (error) {
      const logger = getLogger();
      logger.error("Error creating command detail embed:", error);
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
      case "8ball":
        embed.addFields(
          {
            name: `${EMOJIS.FEATURES.FUN} 🎱 How to Use`,
            value: '```/8ball question:"Will I succeed in my career?"```',
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 What You Need`,
            value:
              "**question** - Ask the intelligent magic 8-ball anything you want to know!",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value:
              "An intelligent response from the mystical oracle with 5 smart categories: Very Positive, Positive, Neutral, Negative, and Very Negative. The 8-ball analyzes your question's sentiment and context to provide more relevant answers!",
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.FUN} 🧠 Smart Features`,
            value:
              "**Sentiment Analysis** - Detects positive/negative keywords in your question\n**Context Awareness** - Recognizes personal, urgent, and emotional questions\n**Smart Weighting** - Adjusts response probabilities based on question type\n**5 Response Levels** - From exceptional fortune to dangerous warnings",
            inline: false,
          },
        );
        break;

      case "avatar":
        embed.addFields(
          {
            name: `${EMOJIS.FEATURES.USER} 🖼️ How to Use`,
            value: "```/avatar [user:@username]```",
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 What You Need`,
            value:
              "**user** *(optional)* - Check a specific member's avatar (leave empty to see your own)",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value:
              "High-quality avatar images with download buttons for both regular and animated versions. Great for sharing profile pictures!",
            inline: false,
          },
        );
        break;

      case "role-reactions":
        embed.addFields(
          {
            name: `${EMOJIS.FEATURES.ROLES} 🎯 How to Use`,
            value: [
              "```/role-reactions setup title:Choose Your Roles description:React to get roles! roles:🎮 @Gamer, 🎨 @Artist```",
              "```/role-reactions setup title:Game Roles description:Pick your role! roles:🎮 Gamer, 🎨 Artist```",
              "```/role-reactions list```",
              "```/role-reactions update message_id:1234567890 title:Updated Title```",
              "```/role-reactions delete message_id:1234567890```",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 Subcommands`,
            value: [
              "**setup** - Create a new role-reaction message",
              "**list** - List all role-reaction messages",
              "**update** - Update an existing role-reaction message",
              "**delete** - Delete a role-reaction message",
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
            value:
              "Interactive role assignment via emoji reactions with customizable embeds, automatic reaction addition, and comprehensive management tools!",
            inline: false,
          },
          {
            name: `${EMOJIS.UI.INFO} 💡 Role Format Tips`,
            value: [
              "• **@RoleName** - Use @ symbol (e.g., `@Gamer`)",
              "• **RoleName** - Use role name directly (e.g., `Gamer`)",
              "• **<@&ID>** - Use role mention (e.g., `<@&123456789>`)",
              '• **"Role Name"** - Use quotes for spaces (e.g., `"Gaming Role"`)',
            ].join("\n"),
            inline: false,
          },
        );
        break;

      case "temp-roles":
        embed.addFields(
          {
            name: `${EMOJIS.FEATURES.TEMPORARY} ⏰ How to Use`,
            value: [
              "```/temp-roles assign users:@user1,@user2 role:@EventRole duration:2h reason:Tournament participation```",
              "```/temp-roles list user:@user1```",
              "```/temp-roles remove users:@user1 role:@EventRole reason:Early removal```",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 Subcommands`,
            value: [
              "**assign** - Assign temporary roles to users that expire after a set duration",
              "**list** - List active temporary roles for a user or all users",
              "**remove** - Remove a temporary role from users before it expires",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} 🔐 Permissions`,
            value: "• **Manage Roles** permission required",
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

      case "xp":
        embed.addFields(
          {
            name: `${EMOJIS.FEATURES.EXPERIENCE} 📊 How to Use`,
            value: [
              "```/xp setup enabled:true message-xp:true command-xp:true role-xp:true voice-xp:true```",
              "```/xp settings```",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 Subcommands`,
            value: [
              "**setup** - Configure the XP system with various options",
              "**settings** - View and manage the XP system settings",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 Setup Options`,
            value: [
              "**enabled** *(optional)* - Enable or disable the XP system",
              "**message-xp** *(optional)* - Enable XP for sending messages",
              "**command-xp** *(optional)* - Enable XP for using commands",
              "**role-xp** *(optional)* - Enable XP for role assignments",
              "**voice-xp** *(optional)* - Enable XP for voice chat participation",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} 🔐 Permissions`,
            value: "• **Manage Server** permission required",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value: [
              "Current XP system status with interactive buttons to:",
              "• Toggle the entire XP system on/off",
              "• Enable/disable message XP, command XP, role XP, and voice XP individually",
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

      case "leaderboard":
        embed.addFields(
          {
            name: `${EMOJIS.FEATURES.EXPERIENCE} 🏆 How to Use`,
            value: "```/leaderboard [limit:10] [type:xp]```",
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 What You Need`,
            value: [
              "**limit** *(optional)* - Number of users to show (1-25, default: 10)",
              "**type** *(optional)* - Choose from: xp, level, messages, voice (default: xp)",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value:
              "A beautiful leaderboard showing top users by XP, level, messages, or voice time. Choose from different ranking types to see who's most active in your server!",
            inline: false,
          },
        );
        break;

      case "level":
        embed.addFields(
          {
            name: `${EMOJIS.FEATURES.EXPERIENCE} 📊 How to Use`,
            value: "```/level [user:@username]```",
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 What You Need`,
            value:
              "**user** *(optional)* - Check a specific member's level (leave empty to see your own)",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value:
              "Detailed level information including current XP, progress to next level, messages sent, commands used, voice time, and roles earned. Perfect for tracking your growth!",
            inline: false,
          },
        );
        break;

      case "ping":
        embed.addFields(
          {
            name: `${EMOJIS.STATUS.SUCCESS} 🏓 How to Use`,
            value: "```/ping```",
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
              "Bot latency information including API latency, heartbeat, and overall connection status. Great for checking if the bot is running smoothly!",
            inline: false,
          },
        );
        break;

      case "sponsor":
        embed.addFields(
          {
            name: `${EMOJIS.FEATURES.SUPPORT} 💝 How to Use`,
            value: "```/sponsor```",
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
              "Information about supporting the bot's development to help keep it free and running for everyone, including why support is needed, how to contribute, and an interactive 'Become a Sponsor' button!",
            inline: false,
          },
        );
        break;

      case "support":
        embed.addFields(
          {
            name: `${EMOJIS.FEATURES.SUPPORT} 🆘 How to Use`,
            value: "```/support```",
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
              "Support information including how to get help, report issues, suggest features, and interactive buttons for Discord support server and GitHub repository!",
            inline: false,
          },
        );
        break;

      case "welcome":
        embed.addFields(
          {
            name: `${EMOJIS.FEATURES.WELCOME} 🎉 How to Use`,
            value: [
              '```/welcome setup channel:#welcome message:"Welcome {user} to {server}! 🎉" auto-role:@Member enabled:true```',
              "```/welcome settings```",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 Subcommands`,
            value: [
              "**setup** - Configure the welcome system with channel, message, and auto-role",
              "**settings** - View and manage current welcome system settings",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} 🔐 Permissions`,
            value: "• **Manage Server** permission required",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value:
              "Interactive welcome system with channel selection, message customization, auto-role assignment, and real-time settings management for new members!",
            inline: false,
          },
        );
        break;

      case "goodbye":
        embed.addFields(
          {
            name: `${EMOJIS.FEATURES.WELCOME} 👋 How to Use`,
            value: [
              '```/goodbye setup channel:#general message:"**{user}** left the server\\nThanks for being part of **{server}**! 👋" enabled:true```',
              "```/goodbye settings```",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 Subcommands`,
            value: [
              "**setup** - Configure the goodbye system with channel and message",
              "**settings** - View and manage current goodbye system settings",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} 🔐 Permissions`,
            value: "• **Manage Server** permission required",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value:
              "Interactive goodbye system with channel selection, message customization, and real-time settings management for members leaving!",
            inline: false,
          },
        );
        break;

      case "core":
        embed.addFields(
          {
            name: `${EMOJIS.ACTIONS.HEART} 💎 How to Use`,
            value: [
              "```/core check```",
              "```/core purchase amount:5```",
              "```/core transfer user:@friend amount:2```",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 Subcommands`,
            value: [
              "**check** - View your current Core balance and tier",
              "**purchase** - Buy Core credits for avatar generation",
              "**transfer** - Send Core credits to other users",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value:
              "Your Core balance, tier information, and transaction history. Core credits are used for AI avatar generation and can be purchased or transferred between users!",
            inline: false,
          },
        );
        break;

      case "poll":
        embed.addFields(
          {
            name: `${EMOJIS.UI.QUESTION} 📊 How to Use`,
            value: [
              "```/poll create```",
              "```/poll list```",
              "```/poll end poll-id:1234567890```",
              "```/poll delete poll-id:1234567890```",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 Subcommands`,
            value: [
              "**create** - Open an interactive form to create a new poll",
              "**list** - List all active polls in the server (with pagination)",
              "**end** - End an active poll early",
              "**delete** - Delete a poll permanently",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} 🔐 Permissions`,
            value:
              "• **Create Polls** - Anyone can create polls\n• **Manage Polls** - Poll creators and admins can close polls",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value:
              "Interactive poll creation form, real-time voting with progress bars, and automatic closing. Great for community decisions and feedback collection!",
            inline: false,
          },
        );
        break;

      case "core-management":
        embed.addFields(
          {
            name: `${EMOJIS.ACTIONS.HEART} 💎 How to Use`,
            value: [
              "```/core-management add user:@username amount:10```",
              "```/core-management remove user:@username amount:5```",
              "```/core-management set user:@username amount:100```",
              "```/core-management tier user:@username tier:Core Basic```",
              "```/core-management remove-tier user:@username```",
              "```/core-management view user:@username```",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 Subcommands`,
            value: [
              "**add** - Add Core credits to a user's account",
              "**remove** - Remove Core credits from a user's account",
              "**set** - Set a user's Core balance to a specific amount",
              "**tier** - Set a user's Core membership tier",
              "**remove-tier** - Remove a user's Core membership tier",
              "**view** - View a user's Core account details",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} 🔐 Permissions`,
            value: "• **Developer** access required",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value:
              "Complete Core credit and tier management system for developers to add, remove, set, and monitor user Core balances and membership tiers across the entire bot!",
            inline: false,
          },
        );
        break;

      case "verify":
        embed.addFields(
          {
            name: `${EMOJIS.STATUS.SUCCESS} ✅ How to Use`,
            value: [
              "```/verify donation user:@username amount:5.00 ko-fi-url:https://ko-fi.com/s/abc123 notes:Monthly supporter```",
              "```/verify subscription user:@username ko-fi-url:https://ko-fi.com/s/def456 notes:Premium subscriber```",
              "```/verify manual user:@username credits:50 notes:Special event compensation```",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.UI.MENU} 📝 Subcommands`,
            value: [
              "**donation** - Verify a Ko-fi donation and grant Core credits",
              "**subscription** - Verify a Ko-fi subscription and grant Core membership",
              "**manual** - Manually add Core credits without Ko-fi verification",
            ].join("\n"),
            inline: false,
          },
          {
            name: `${EMOJIS.FEATURES.SECURITY} 🔐 Permissions`,
            value: "• **Developer** access required",
            inline: false,
          },
          {
            name: `${EMOJIS.STATUS.INFO} 👀 What You'll See`,
            value:
              "Manual verification system for Ko-fi donations and subscriptions, with automatic Core credit assignment and comprehensive transaction tracking for developers!",
            inline: false,
          },
        );
        break;
    }
  }
}
