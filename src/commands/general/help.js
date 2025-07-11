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
    .setDescription(
      "Get help and information about the bot. Use `/help [command]` for details on a specific command.",
    )
    .addStringOption(option =>
      option
        .setName("command")
        .setDescription(
          "The command to get help for (e.g. setup-roles, update-roles, etc.)",
        )
        .setRequired(false)
        .addChoices(
      { name: "Delete Roles - Delete a role-reaction message", value: "delete-roles" },
      { name: "List Roles - List all role-reaction messages", value: "list-roles" },
      { name: "Setup Roles - Create a role-reaction message for self-assignable roles", value: "setup-roles" },
      { name: "Update Roles - Update an existing role-reaction message", value: "update-roles" }
    ),
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
        "A Discord bot for self-assignable roles through reactions.\n\n" +
          "**Usage:** `/help [command]` to get detailed help for a specific command.",
      )
      .setColor(0x0099ff)
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({
        text: `RoleReactor Bot v${BOT_VERSION} • Role Management System`,
        iconURL: client.user.displayAvatarURL(),
      });

    const availableCommands = client.commands
      .filter(cmd => !cmd.hidden && cmd.data && cmd.data.name !== "help")
      .map(
        cmd =>
          `• \`/${cmd.data.name}\` — ${cmd.data.description.split(".")[0]}`,
      )
      .join("\n");

    embed.addFields({
      name: "🔧 Available Commands",
      value: availableCommands || "No commands available.",
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

    // User-focused support/help section
    embed.addFields({
      name: "🆘 Need Help?",
      value: [
        "• Use `/help [command]` for details on a specific command.",
        "• Visit our [Support Server](https://discord.gg/rolereactor) for live help.",
        "• See the [Documentation](https://github.com/rolereactor-bot/role-reactor-bot/wiki) for guides and FAQs.",
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
