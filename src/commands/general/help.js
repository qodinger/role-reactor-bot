import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { BOT_VERSION } from "../../utils/version.js";

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get help and information about the bot")
    .addStringOption(option =>
      option
        .setName("command")
        .setDescription("Get help for a specific command")
        .setRequired(false),
    ),

  async execute(interaction, client) {
    const command = interaction.options.getString("command");

    if (command) {
      return await showCommandHelp(interaction, command);
    }

    // Main help embed
    const embed = new EmbedBuilder()
      .setTitle("🤖 RoleReactor Bot Help")
      .setDescription(
        "A Discord bot for self-assignable roles through reactions.",
      )
      .setColor(0x0099ff)
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({
        text: `RoleReactor Bot v${BOT_VERSION} • Role Management System`,
        iconURL: client.user.displayAvatarURL(),
      });

    // Bot Information
    embed.addFields({
      name: "📊 Bot Statistics",
      value: [
        `**Servers:** ${client.guilds.cache.size.toLocaleString()}`,
        `**Users:** ${client.users.cache.size.toLocaleString()}`,
        `**Uptime:** ${formatUptime(client.uptime)}`,
        `**Memory:** ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(
          2,
        )} MB`,
      ].join("\n"),
      inline: true,
    });

    // Available Commands
    embed.addFields({
      name: "🔧 Available Commands",
      value: [
        "`/setup-roles` — **Create** a new role-reaction message for self-assignable roles. _Use this to let users assign themselves roles by reacting to a message._",
        "`/update-roles` — **Update** an existing role-reaction message (title, description, roles, color). _Use this to update the content or roles of an existing message._",
        "`/delete-roles` — **Delete** a role-reaction message by message ID. _Use this to delete a role-reaction message and its mapping._",
        "`/list-roles` — **List** all current role-reaction messages and their message IDs. _Use this to find message IDs for editing or removal._",
        "`/help` — Show this help message and command details.",
      ].join("\n"),
      inline: false,
    });

    // Usage Examples
    embed.addFields({
      name: "📖 Usage Examples",
      value: [
        "• `/setup-roles title:'Server Roles' description:'Pick your roles!' roles:'🎮:Gamer,🎨:Artist'`",
        "• `/update-roles message_id:123456789012345678 title:'New Title' roles:'🎮:Gamer,🎨:Artist'`",
        "• `/delete-roles message_id:123456789012345678`",
        "• `/list-roles`",
        "• `/help update-roles`",
      ].join("\n"),
      inline: false,
    });

    // Quick Start Guide
    embed.addFields({
      name: "🚀 Quick Start",
      value: [
        "1. Use `/setup-roles` to create a role message",
        "2. Users react to get roles automatically",
        "3. Remove reactions to lose roles",
        "4. Manage with `/delete-roles` when needed",
      ].join("\n"),
      inline: false,
    });

    // Features
    embed.addFields({
      name: "✨ Features",
      value: [
        "🎯 **Self-Assignable Roles** - Users can assign/remove roles",
        "🛡️ **Permission Controls** - Secure admin-only setup",
        "🎨 **Custom Emojis** - Unicode and server emojis supported",
        "⚡ **High Performance** - Optimized for large servers",
        "🛠️ **Error Handling** - Graceful error management",
      ].join("\n"),
      inline: false,
    });

    // Support Information
    embed.addFields({
      name: "🆘 Support",
      value: [
        "**Documentation:** [GitHub Wiki](https://github.com/rolereactor-bot/role-reactor-bot/wiki)",
        "**Issues:** [GitHub Issues](https://github.com/rolereactor-bot/role-reactor-bot/issues)",
        "**Discord:** [Support Server](https://discord.gg/rolereactor)",
        "**Website:** [RoleReactor.com](https://rolereactor.com)",
      ].join("\n"),
      inline: false,
    });

    // Create buttons for quick actions
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Documentation")
        .setURL("https://github.com/rolereactor-bot/role-reactor-bot/wiki")
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel("Support Server")
        .setURL("https://discord.gg/rolereactor")
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel("GitHub")
        .setURL("https://github.com/rolereactor-bot/role-reactor-bot")
        .setStyle(ButtonStyle.Link),
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
    });
  },
};

async function showCommandHelp(interaction, commandName) {
  const command = interaction.client.commands.get(commandName);

  if (!command) {
    return await interaction.reply({
      content: "❌ Command not found!",
      ephemeral: true,
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(`🔧 Command: /${command.data.name}`)
    .setDescription(command.data.description || "No description available.")
    .setColor(0x0099ff)
    .setTimestamp()
    .setFooter({
      text: "RoleReactor Bot • Command Help",
      iconURL: interaction.client.user.displayAvatarURL(),
    });

  // Add command-specific help
  switch (commandName) {
    case "setup-roles":
      embed.addFields({
        name: "📝 Usage",
        value:
          '`/setup-roles title:"Server Roles" description:"Choose your roles!" roles:"🎮:Gamer,🎨:Artist,💻:Developer"`',
        inline: false,
      });
      embed.addFields({
        name: "📋 Parameters",
        value: [
          "**title** - The title of the role message",
          "**description** - Description text for the message",
          "**roles** - Role-emoji pairs (format: emoji:role,emoji:role or one per line)",
        ].join("\n"),
        inline: false,
      });
      embed.addFields({
        name: "🔐 Permissions Required",
        value:
          "• Manage Roles (User)\n• Manage Messages (Bot)\n• Add Reactions (Bot)",
        inline: false,
      });
      embed.addFields({
        name: "💡 Examples",
        value: [
          "`🎮:Gamer,🎨:Artist,💻:Developer`",
          "`<:verified:123456789>:Verified,<:moderator:987654321>:Moderator`",
          "`🎵:Music Lover,📚:Book Club,🏃:Fitness`",
        ].join("\n"),
        inline: false,
      });
      break;

    case "update-roles":
      embed.addFields({
        name: "📝 Usage",
        value:
          "`/update-roles message_id:123456789012345678 title:'New Title' roles:'🎮:Gamer,🎨:Artist'`",
        inline: false,
      });
      embed.addFields({
        name: "📋 Parameters",
        value: [
          "**message_id** - The ID of the role-reaction message to update",
          "**title** (optional) - New title for the message",
          "**description** (optional) - New description for the message",
          "**roles** (optional) - New role-emoji pairs",
          "**color** (optional) - New color for the embed (hex format)",
        ].join("\n"),
        inline: false,
      });
      embed.addFields({
        name: "🔐 Permissions Required",
        value: "• Manage Roles (User)\n• Manage Messages (Bot)",
        inline: false,
      });
      break;

    case "delete-roles":
      embed.addFields({
        name: "📝 Usage",
        value: "`/delete-roles message_id:123456789012345678`",
        inline: false,
      });
      embed.addFields({
        name: "📋 Parameters",
        value: "**message_id** - The ID of the role-reaction message to delete",
        inline: false,
      });
      embed.addFields({
        name: "🔐 Permissions Required",
        value: "• Manage Roles (User)\n• Manage Messages (Bot)",
        inline: false,
      });
      break;

    case "list-roles":
      embed.addFields({
        name: "📝 Usage",
        value: "`/list-roles`",
        inline: false,
      });
      embed.addFields({
        name: "📋 Parameters",
        value: "No parameters required",
        inline: false,
      });
      embed.addFields({
        name: "🔐 Permissions Required",
        value: "• Manage Roles (User)",
        inline: false,
      });
      embed.addFields({
        name: "💡 What it shows",
        value:
          "Lists all active role-reaction messages with their message IDs, titles, and channel locations",
        inline: false,
      });
      break;

    case "help":
      embed.addFields({
        name: "📝 Usage",
        value: "`/help [command]`",
        inline: false,
      });
      embed.addFields({
        name: "📋 Parameters",
        value: "**command** (optional) - Get help for a specific command",
        inline: false,
      });
      break;
  }

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
