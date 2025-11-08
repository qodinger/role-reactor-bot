import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { THEME_COLOR, UI_COMPONENTS } from "../../../config/theme.js";
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
      embed.addFields({
        name: `Voice Channel Permissions`,
        value: [
          `**Automatic Voice Management** - Works for ALL role assignments:`,
          `• **Commands** - \`/temp-roles\`, \`/schedule-role\`, role reactions`,
          `• **Manual Assignment** - When admins manually add/remove roles`,
          `• **Any Method** - Works automatically regardless of how roles are assigned`,
          ``,
          `**How It Works:**`,
          `• **Connect Disabled** → Users are disconnected from voice channels`,
          `• **Speak Disabled** → Users are muted in voice channels`,
          `• **Role Removed** → Users are automatically unmuted`,
          ``,
          `**Requirements:** Bot needs \`Move Members\` and \`Mute Members\` permissions`,
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
   * @returns {import('discord.js').EmbedBuilder}
   */
  static createAllCommandsEmbed(client, member = null) {
    const embed = new EmbedBuilder()
      .setTitle(`All Commands`)
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
      const { COMMAND_METADATA } = getDynamicHelpData(client);
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
  static createCommandDetailEmbed(command, client) {
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

      // Add command-specific help based on command name
      this.addCommandSpecificHelp(embed, command.data.name);

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
   * @param {import('discord.js').EmbedBuilder} embed
   * @param {string} commandName
   */
  static addCommandSpecificHelp(embed, commandName) {
    switch (commandName) {
      case "8ball":
        embed.addFields(
          {
            name: `How to Use`,
            value: "```/8ball question:Will I succeed in my career?```",
            inline: false,
          },
          {
            name: `What You Need`,
            value:
              "**question** *(required)* - Ask the intelligent magic 8-ball anything you want to know!",
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• No special permissions required",
            inline: false,
          },
          {
            name: `What You'll See`,
            value:
              "An intelligent response from the mystical oracle with 5 smart categories: Very Positive, Positive, Neutral, Negative, and Very Negative. The 8-ball analyzes your question's sentiment and context to provide more relevant answers!",
            inline: false,
          },
          {
            name: `Smart Features`,
            value:
              "**Sentiment Analysis** - Detects positive/negative keywords in your question\n**Context Awareness** - Recognizes personal, urgent, and emotional questions\n**Smart Weighting** - Adjusts response probabilities based on question type\n**5 Response Levels** - From exceptional fortune to dangerous warnings",
            inline: false,
          },
        );
        break;

      case "avatar":
        embed.addFields(
          {
            name: `How to Use`,
            value:
              "```/avatar prompt:cyberpunk hacker with neon hair color_style:vibrant```",
            inline: false,
          },
          {
            name: `What You Need`,
            value:
              "**prompt** *(required)* - Describe the avatar you want to generate (e.g., 'cyberpunk hacker with neon hair')\n**color_style** *(optional)* - Choose a color palette (vibrant, pastel, monochrome, neon, warm, cool)\n**mood** *(optional)* - Choose the character's mood (happy, serious, mysterious, cute, cool, elegant)\n**art_style** *(optional)* - Choose the artistic style (studio, manga, modern, retro, realistic, chibi, lofi)",
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• **Send Messages** permission required",
            inline: false,
          },
          {
            name: `What You'll See`,
            value:
              "A unique AI-generated anime-style avatar based on your description, with download options and generation details. Uses advanced AI to create custom avatars tailored to your specifications!",
            inline: false,
          },
        );
        break;

      case "role-reactions":
        embed.addFields(
          {
            name: `How to Use`,
            value: [
              "```/role-reactions setup title:Choose Your Roles description:React to get roles! roles:🎮:@Gamer, 🎨:@Artist```",
              "```/role-reactions setup title:Game Roles description:Pick your role! roles:🎮:Gamer, 🎨:Artist```",
              "```/role-reactions list```",
              "```/role-reactions update message_id:1234567890 title:Updated Title```",
              "```/role-reactions delete message_id:1234567890```",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Subcommands`,
            value: [
              "**setup** - Create a new role-reaction message",
              "**list** - List all role-reaction messages",
              "**update** - Update an existing role-reaction message",
              "**delete** - Delete a role-reaction message",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• **Manage Roles** permission required",
            inline: false,
          },
          {
            name: `What You'll See`,
            value:
              "Interactive role assignment via emoji reactions with customizable embeds, automatic reaction addition, and comprehensive management tools!",
            inline: false,
          },
          {
            name: `Role Format Tips`,
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
            name: `How to Use`,
            value: [
              "```/temp-roles assign users:@user1,@user2 role:@EventRole duration:2h reason:Tournament participation notify:true```",
              "```/temp-roles assign users:@RoleName role:@Mute duration:5m notify-expiry:true```",
              "```/temp-roles list user:@user1```",
              "```/temp-roles remove users:@user1,@user2 role:@EventRole reason:Early removal notify:true```",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Subcommands`,
            value: [
              "**assign** - Assign temporary roles to users that expire after a set duration",
              "**list** - List active temporary roles for a user or all users",
              "**remove** - Remove a temporary role from users before it expires",
            ].join("\n"),
            inline: false,
          },
          {
            name: `User Targeting`,
            value: [
              "• **User mentions** - `@user1,@user2` (target specific users)",
              "• **Role mentions** - `@RoleName` (target all members with that role)",
              "• **User IDs** - `123456789,987654321` (target by ID)",
              "• **@everyone** - Target all server members",
              "• **Mix formats** - Combine any of the above (e.g., `@user1,@RoleName,123456789`)",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Options`,
            value: [
              "**users** *(required)* - Users to assign/remove role from (supports mentions, IDs, role mentions, @everyone)",
              "**role** *(required)* - The role to assign or remove",
              "**duration** *(required for assign)* - How long the role lasts (e.g., 30m, 2h, 1d, 1w)",
              "**reason** *(optional)* - Reason for the role assignment/removal",
              "**notify** *(optional)* - Send DM notification when role is assigned/removed (default: false)",
              "**notify-expiry** *(optional)* - Send DM notification when role expires (default: false)",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Time Examples`,
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
            name: `Permissions`,
            value: "• **Manage Roles** permission required",
            inline: false,
          },
          {
            name: `Perfect For`,
            value:
              "Events, tournaments, giveaways, VIP access, beta testing, temporary mutes, or any temporary special access!",
            inline: false,
          },
        );
        break;

      case "help":
        embed.addFields(
          {
            name: `How to Use`,
            value: "```/help [command]```",
            inline: false,
          },
          {
            name: `What You Need`,
            value:
              "**command** *(optional)* - Get detailed help for a specific command",
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• No special permissions required",
            inline: false,
          },
          {
            name: `What You'll See`,
            value:
              "Detailed instructions, examples, and everything you need to know about using the bot effectively!",
            inline: false,
          },
        );
        break;

      case "health":
        embed.addFields(
          {
            name: `How to Use`,
            value: "```/health```",
            inline: false,
          },
          {
            name: `What You Need`,
            value: "No parameters needed - just run the command!",
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• **Developer** access required",
            inline: false,
          },
          {
            name: `What You'll See`,
            value:
              "Bot uptime, memory usage, server count, and overall health status - perfect for checking if everything is running smoothly!",
            inline: false,
          },
        );
        break;

      case "performance":
        embed.addFields(
          {
            name: `How to Use`,
            value: "```/performance```",
            inline: false,
          },
          {
            name: `What You Need`,
            value: "No parameters needed - just run the command!",
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• **Developer** access required",
            inline: false,
          },
          {
            name: `What You'll See`,
            value:
              "Command usage statistics, event processing metrics, and performance data - great for understanding how your community uses the bot!",
            inline: false,
          },
        );
        break;

      case "storage":
        embed.addFields(
          {
            name: `How to Use`,
            value: "```/storage```",
            inline: false,
          },
          {
            name: `What You Need`,
            value: "No parameters needed - just run the command!",
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• **Developer** access required",
            inline: false,
          },
          {
            name: `What You'll See`,
            value:
              "Database connection status, local file storage info, and sync status - ensures your role data is safe and backed up!",
            inline: false,
          },
        );
        break;

      case "invite":
        embed.addFields(
          {
            name: `How to Use`,
            value: "```/invite```",
            inline: false,
          },
          {
            name: `What You Need`,
            value: "No parameters needed - just run the command!",
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• No special permissions required",
            inline: false,
          },
          {
            name: `What You'll See`,
            value:
              "An invite link to add Role Reactor Bot to your server. The link is sent as an ephemeral message, so only you can see it. Share it with others to invite the bot!",
            inline: false,
          },
        );
        break;

      case "xp":
        embed.addFields(
          {
            name: `How to Use`,
            value: "```/xp settings```",
            inline: false,
          },
          {
            name: `What You Need`,
            value:
              "No parameters needed - just run the subcommand to access the XP system settings!",
            inline: false,
          },
          {
            name: `Subcommands`,
            value: [
              "**settings** - View and configure XP system settings",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• **Manage Server** permission required",
            inline: false,
          },
          {
            name: `What You'll See`,
            value: [
              "Interactive XP system management interface with buttons to:",
              "• Toggle the entire XP system on/off",
              "• Enable/disable message XP, command XP, role XP, and voice XP individually",
              "• View current XP amounts, cooldowns, and settings",
              "• Access configuration help and reset options",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Quick Actions`,
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
            name: `How to Use`,
            value: "```/leaderboard [limit:10] [type:xp]```",
            inline: false,
          },
          {
            name: `What You Need`,
            value: [
              "**limit** *(optional)* - Number of users to show (1-20, default: 10)",
              "**type** *(optional)* - Choose from: xp, level, messages, voice (default: xp)",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• **View Channel** permission required",
            inline: false,
          },
          {
            name: `Leaderboard Types`,
            value: [
              "**xp** - Total experience points (default)",
              "**level** - Current level",
              "**messages** - Total messages sent",
              "**voice** - Total voice time",
            ].join("\n"),
            inline: false,
          },
          {
            name: `What You'll See`,
            value:
              "A beautiful leaderboard showing top users by XP, level, messages, or voice time. Choose from different ranking types to see who's most active in your server!",
            inline: false,
          },
        );
        break;

      case "level":
        embed.addFields(
          {
            name: `How to Use`,
            value: "```/level [user:@username]```",
            inline: false,
          },
          {
            name: `What You Need`,
            value:
              "**user** *(optional)* - Check a specific member's level (leave empty to see your own)",
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• **View Channel** permission required",
            inline: false,
          },
          {
            name: `What You'll See`,
            value:
              "Detailed level information including current XP, progress to next level, and rank. Perfect for tracking your growth and comparing with other members!",
            inline: false,
          },
        );
        break;

      case "ping":
        embed.addFields(
          {
            name: `How to Use`,
            value: "```/ping```",
            inline: false,
          },
          {
            name: `What You Need`,
            value: "No parameters needed - just run the command!",
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• No special permissions required",
            inline: false,
          },
          {
            name: `What You'll See`,
            value:
              "Bot latency information including API latency, heartbeat, and overall connection status. Great for checking if the bot is running smoothly!",
            inline: false,
          },
        );
        break;

      case "sponsor":
        embed.addFields(
          {
            name: `How to Use`,
            value: "```/sponsor```",
            inline: false,
          },
          {
            name: `What You Need`,
            value: "No parameters needed - just run the command!",
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• No special permissions required",
            inline: false,
          },
          {
            name: `What You'll See`,
            value:
              "Information about supporting the bot's development to help keep it free and running for everyone, including why support is needed, how to contribute, and an interactive 'Become a Sponsor' button!",
            inline: false,
          },
        );
        break;

      case "support":
        embed.addFields(
          {
            name: `How to Use`,
            value: "```/support```",
            inline: false,
          },
          {
            name: `What You Need`,
            value: "No parameters needed - just run the command!",
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• No special permissions required",
            inline: false,
          },
          {
            name: `What You'll See`,
            value:
              "Support information including how to get help, report issues, suggest features, and interactive buttons for Discord support server and GitHub repository!",
            inline: false,
          },
        );
        break;

      case "welcome":
        embed.addFields(
          {
            name: `How to Use`,
            value: [
              "```/welcome setup channel:#welcome message:Welcome {user} to {server}! 🎉 auto-role:@Member enabled:true```",
              "```/welcome settings```",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Subcommands`,
            value: [
              "**setup** - Configure the welcome system with channel, message, and auto-role",
              "**settings** - View and manage current welcome system settings",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• **Manage Server** permission required",
            inline: false,
          },
          {
            name: `What You'll See`,
            value:
              "Interactive welcome system with channel selection, message customization, auto-role assignment, and real-time settings management for new members!",
            inline: false,
          },
        );
        break;

      case "goodbye":
        embed.addFields(
          {
            name: `How to Use`,
            value: [
              "```/goodbye setup channel:#general message:**{user}** left the server! Thanks for being part of **{server}**! 👋 enabled:true```",
              "```/goodbye settings```",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Subcommands`,
            value: [
              "**setup** - Configure the goodbye system with channel and message",
              "**settings** - View and manage current goodbye system settings",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• **Manage Server** permission required",
            inline: false,
          },
          {
            name: `What You'll See`,
            value:
              "Interactive goodbye system with channel selection, message customization, and real-time settings management for members leaving!",
            inline: false,
          },
        );
        break;

      case "core":
        embed.addFields(
          {
            name: `How to Use`,
            value: ["```/core balance```", "```/core pricing```"].join("\n"),
            inline: false,
          },
          {
            name: `What You Need`,
            value: "No parameters needed - just run the subcommand!",
            inline: false,
          },
          {
            name: `Subcommands`,
            value: [
              "**balance** - View your current Core balance and tier status",
              "**pricing** - View Core pricing, membership benefits, and donation options",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• **Send Messages** permission required",
            inline: false,
          },
          {
            name: `What You'll See`,
            value:
              "Your Core balance, tier information, and transaction history. Core credits are used for AI avatar generation and can be purchased or transferred between users!",
            inline: false,
          },
        );
        break;

      case "poll":
        embed.addFields(
          {
            name: `How to Use`,
            value: [
              "```/poll create```",
              "```/poll list```",
              "```/poll end poll-id:1234567890```",
              "```/poll delete poll-id:1234567890```",
            ].join("\n"),
            inline: false,
          },
          {
            name: `What You Need`,
            value: [
              "**create** - No parameters needed, opens interactive form",
              "**list** - No parameters needed, shows all polls",
              "**end** - **poll-id** *(required)* - The poll ID to end",
              "**delete** - **poll-id** *(required)* - The poll ID to delete",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Subcommands`,
            value: [
              "**create** - Open an interactive form to create a new poll",
              "**list** - List all active polls in the server (with pagination)",
              "**end** - End an active poll early",
              "**delete** - Delete a poll permanently",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Permissions`,
            value:
              "• **Send Messages** permission required\n• **Create Polls** - Anyone can create polls\n• **Manage Polls** - Poll creators and admins can close polls",
            inline: false,
          },
          {
            name: `What You'll See`,
            value:
              "Interactive poll creation form, real-time voting with progress bars, and automatic closing. Great for community decisions and feedback collection!",
            inline: false,
          },
        );
        break;

      case "schedule-role":
        embed.addFields(
          {
            name: `How to Use`,
            value: [
              "```/schedule-role create action:assign role:@EventRole users:@user1,@RoleName schedule-type:one-time schedule:tomorrow 8am```",
              "```/schedule-role create action:remove role:@Mute users:@RoleName schedule-type:daily schedule:9am```",
              "```/schedule-role list page:1 show-all:false```",
              "```/schedule-role view schedule-id:abc123```",
              "```/schedule-role cancel schedule-id:abc123```",
              "```/schedule-role delete schedule-id:abc123```",
            ].join("\n"),
            inline: false,
          },
          {
            name: `What You Need`,
            value: [
              "**create** - **action** *(required)*, **role** *(required)*, **users** *(required)*, **schedule-type** *(required)*, **schedule** *(required)*, **reason** *(optional)*",
              "**list** - **page** *(optional)*, **show-all** *(optional)*",
              "**view** - **schedule-id** *(required)*",
              "**cancel** - **schedule-id** *(required)*",
              "**delete** - **schedule-id** *(required)*",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Subcommands`,
            value: [
              "**create** - Create a new scheduled role assignment or removal",
              "**list** - List all active scheduled roles with pagination",
              "**view** - View details of a specific scheduled role",
              "**cancel** - Cancel a scheduled role (keeps in database)",
              "**delete** - Permanently delete a scheduled role from database",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Schedule Types`,
            value: [
              "**one-time** - Execute once at the specified time",
              "**daily** - Execute every day at the specified time",
              "**weekly** - Execute every week on the specified day and time",
              "**monthly** - Execute every month on the specified date and time",
              "**custom** - Execute at custom intervals (specified in minutes)",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Schedule Format Examples`,
            value: [
              "`tomorrow 8am` - Tomorrow at 8:00 AM",
              "`9am` - Today at 9:00 AM (if before 9am) or tomorrow",
              "`monday 9am` - Next Monday at 9:00 AM",
              "`15 2pm` - 15th of this month at 2:00 PM",
              "`60` - 60 minutes from now (for custom intervals)",
            ].join("\n"),
            inline: false,
          },
          {
            name: `User Targeting`,
            value: [
              "• **User mentions** - `@user1,@user2` (target specific users)",
              "• **Role mentions** - `@RoleName` (target all members with that role)",
              "• **User IDs** - `123456789,987654321` (target by ID)",
              "• **@everyone** - Target all server members",
              "• **Mix formats** - Combine any of the above",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• **Manage Roles** permission required",
            inline: false,
          },
          {
            name: `Perfect For`,
            value:
              "Automated role assignments for events, scheduled maintenance, recurring tasks, or any time-based role management!",
            inline: false,
          },
        );
        break;

      case "core-management":
        embed.addFields(
          {
            name: `How to Use`,
            value: [
              "```/core-management add user:@username amount:10 reason:Donation bonus```",
              "```/core-management remove user:@username amount:5 reason:Refund```",
              "```/core-management set user:@username amount:100 reason:Reset balance```",
              "```/core-management view user:@username```",
              "```/core-management add-donation user:@username amount:5.00 ko-fi-url:https://ko-fi.com/...```",
              "```/core-management cancel-subscription user:@username reason:User request```",
            ].join("\n"),
            inline: false,
          },
          {
            name: `What You Need`,
            value: [
              "**add** - **user** *(required)*, **amount** *(required)*, **reason** *(optional)*",
              "**remove** - **user** *(required)*, **amount** *(required)*, **reason** *(optional)*",
              "**set** - **user** *(required)*, **amount** *(required)*, **reason** *(optional)*",
              "**view** - **user** *(required)*",
              "**add-donation** - **user** *(required)*, **amount** *(required)*, **ko-fi-url** *(optional)*, **reason** *(optional)*",
              "**cancel-subscription** - **user** *(required)*, **reason** *(optional)*",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Subcommands`,
            value: [
              "**add** - Add bonus Cores (donation Cores only) to a user's account",
              "**remove** - Remove bonus Cores (donation Cores only) from a user's account",
              "**set** - Set a user's bonus Core balance to a specific amount (donation Cores only, not subscription Cores)",
              "**view** - View a user's Core information and breakdown",
              "**add-donation** - Verify a Ko-fi donation and grant bonus Cores",
              "**cancel-subscription** - Manually cancel a user's Core subscription",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Options`,
            value: [
              "**user** *(required)* - The user to manage Cores for",
              "**amount** *(required)* - Amount of Cores to add/remove/set (1-10000 for add/remove, 0-10000 for set)",
              "**reason** *(optional)* - Reason for the Core management action",
              "**ko-fi-url** *(optional for add-donation)* - Ko-fi donation URL for verification",
            ].join("\n"),
            inline: false,
          },
          {
            name: `Permissions`,
            value: "• **Developer** access required",
            inline: false,
          },
          {
            name: `What You'll See`,
            value:
              "Complete Core credit and tier management system for developers to add, remove, set, and monitor user Core balances and membership tiers across the entire bot!",
            inline: false,
          },
        );
        break;
    }
  }
}
