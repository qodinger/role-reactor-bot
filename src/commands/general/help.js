import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { THEME_COLOR } from "../../config/theme.js";

// Generate general help content
export function generateGeneralHelp() {
  return [
    "Available commands:",
    "• `/setup-roles` - Create a role-reaction message",
    "• `/update-roles` - Update an existing role-reaction message",
    "• `/delete-roles` - Delete a role-reaction message",
    "• `/list-roles` - List all role-reaction messages",
    "• `/assign-temp-role` - Assign a temporary role",
    "• `/remove-temp-role` - Remove a temporary role",
    "• `/list-temp-roles` - List temporary roles",
    "• `/help` - Show this help message",
  ].join("\n");
}

// Generate command-specific help content
export function generateCommandHelp(commandInfo) {
  const lines = [`**${commandInfo.name}**`, commandInfo.description];

  if (commandInfo.examples) {
    lines.push("**Examples:**");
    lines.push(...commandInfo.examples);
  }

  return lines.join("\n");
}

// Categorize commands by type
export function categorizeCommands(commands) {
  const categories = {
    admin: [],
    general: [],
  };

  for (const command of commands) {
    if (
      command.name.includes("setup") ||
      command.name.includes("update") ||
      command.name.includes("delete") ||
      command.name.includes("assign") ||
      command.name.includes("remove") ||
      command.name.includes("list")
    ) {
      categories.admin.push(command);
    } else {
      categories.general.push(command);
    }
  }

  return categories;
}

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription(
      "Get help and information about the bot. Use `/help [command]` for details on a specific command.",
    )
    .addStringOption(
      option =>
        option
          .setName("command")
          .setDescription(
            "The command to get help for (e.g. setup-roles, update-roles, etc.)",
          )
          .setRequired(false)
          .addChoices(), // Placeholder for deploy-commands.js to auto-insert choices
    ),

  async execute(interaction, client) {
    const command = interaction.options.getString("command");

    if (command) {
      return await showCommandHelp(interaction, command);
    }

    // Main help embed
    const embed = new EmbedBuilder()
      .setAuthor({
        name: client.user.username,
        iconURL: client.user.displayAvatarURL(),
      })
      .setDescription(
        "A Discord bot for self-assignable roles through reactions.\n\n" +
          "**Usage:** `/help [command]` to get detailed help for a specific command.",
      )
      .setColor(THEME_COLOR)
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({
        text: `Requested by ${interaction.user.tag} • Thanks for using RoleReactor!`,
        iconURL: client.user.displayAvatarURL(),
      });

    // Quick Start Guide
    embed.addFields({
      name: "🚀 Quick Start",
      value: [
        "1. Use `/setup-roles` to create a role message",
        "2. Users react to get roles automatically",
        "3. Remove reactions to lose roles",
        "4. Use `/assign-temp-role` for temporary roles",
        "5. Manage with `/delete-roles` when needed",
      ].join("\n"),
      inline: false,
    });

    // User-focused support/help section
    embed.addFields({
      name: "🆘 Need Help?",
      value: [
        "• Use `/help [command]` for details on a specific command.",
        "• Visit our [Support Server](https://discord.gg/rolereactor) for live help.",
        "• See the [Documentation](https://github.com/tyecode/role-reactor-bot/blob/main/README.md) for guides and FAQs.",
      ].join("\n"),
      inline: false,
    });

    // Donation section
    embed.addFields({
      name: "💝 Support the Project",
      value: [
        "• [Buy me a coffee](https://buymeacoffee.com/tyecode) ☕",
        "• [GitHub Sponsors](https://github.com/sponsors/tyecode) ⭐",
        "• [Patreon](https://patreon.com/tyecode) 🎭",
        "Your support helps keep this bot free and maintained!",
      ].join("\n"),
      inline: false,
    });

    // Create buttons for quick actions
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Documentation")
        .setURL(
          "https://github.com/tyecode/role-reactor-bot/blob/main/README.md",
        )
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel("Support Server")
        .setURL("https://discord.gg/rolereactor")
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel("GitHub")
        .setURL("https://github.com/tyecode/role-reactor-bot")
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
    .setColor(THEME_COLOR)
    .setTimestamp()
    .setFooter({
      text: `Requested by ${interaction.user.tag} • Thanks for using RoleReactor!`,
      iconURL: interaction.client.user.displayAvatarURL(),
    });

  // Add command-specific help
  switch (commandName) {
    case "setup-roles":
      embed.addFields({
        name: "📝 Usage",
        value:
          '`/setup-roles title:"Server Roles" description:"Choose your roles!" roles:"🎮:Gamer,🎨:Artist,💻:Developer" color:"#0099ff"`',
        inline: false,
      });
      embed.addFields({
        name: "📋 Parameters",
        value: [
          "**title** - The title of the role message",
          "**description** - Description text for the message",
          "**roles** - Role-emoji pairs (format: emoji:role,emoji:role or one per line)",
          "**color** (optional) - Embed color (hex code like #0099ff or choose from preset colors)",
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
          "`/update-roles message_id:123456789012345678 title:'New Title' roles:'🎮:Gamer,🎨:Artist' color:'#ff0000'`",
        inline: false,
      });
      embed.addFields({
        name: "📋 Parameters",
        value: [
          "**message_id** - The ID of the role-reaction message to update",
          "**title** (optional) - New title for the message",
          "**description** (optional) - New description for the message",
          "**roles** (optional) - New role-emoji pairs",
          "**color** (optional) - New color for the embed (hex format like #ff0000)",
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

    case "assign-temp-role":
      embed.addFields({
        name: "📝 Usage",
        value:
          '`/assign-temp-role user:@username role:@role duration:"2h" reason:"Event participation"`',
        inline: false,
      });
      embed.addFields({
        name: "📋 Parameters",
        value: [
          "**user** - The user to assign the temporary role to",
          "**role** - The role to assign temporarily",
          "**duration** - How long the role should last (e.g., 30m, 2h, 1d, 1w)",
          "**reason** (optional) - Reason for assigning the temporary role",
        ].join("\n"),
        inline: false,
      });
      embed.addFields({
        name: "🔐 Permissions Required",
        value: "• Manage Roles (User)\n• Manage Roles (Bot)",
        inline: false,
      });
      embed.addFields({
        name: "💡 Duration Examples",
        value: [
          "`30m` - 30 minutes",
          "`2h` - 2 hours",
          "`1d` - 1 day",
          "`1w` - 1 week",
          "`1h30m` - 1 hour 30 minutes",
        ].join("\n"),
        inline: false,
      });
      break;

    case "list-temp-roles":
      embed.addFields({
        name: "📝 Usage",
        value: "`/list-temp-roles [user:@username]`",
        inline: false,
      });
      embed.addFields({
        name: "📋 Parameters",
        value: [
          "**user** (optional) - The user to check temporary roles for (leave empty for all users)",
        ].join("\n"),
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
          "Lists all temporary roles with their expiration times and remaining duration",
        inline: false,
      });
      break;

    case "remove-temp-role":
      embed.addFields({
        name: "📝 Usage",
        value:
          '`/remove-temp-role user:@username role:@role reason:"Early removal"`',
        inline: false,
      });
      embed.addFields({
        name: "📋 Parameters",
        value: [
          "**user** - The user to remove the temporary role from",
          "**role** - The temporary role to remove",
          "**reason** (optional) - Reason for removing the temporary role",
        ].join("\n"),
        inline: false,
      });
      embed.addFields({
        name: "🔐 Permissions Required",
        value: "• Manage Roles (User)\n• Manage Roles (Bot)",
        inline: false,
      });
      embed.addFields({
        name: "💡 Note",
        value:
          "This command only works on temporary roles assigned through the bot",
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
