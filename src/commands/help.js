const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get help and information about RoleReactor Bot")
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription("Get help for a specific command")
        .setRequired(false)
        .addChoices(
          { name: "setup-roles", value: "setup-roles" },
          { name: "remove-roles", value: "remove-roles" },
          { name: "help", value: "help" }
        )
    ),

  async execute(interaction, client) {
    const command = interaction.options.getString("command");

    if (command) {
      return await showCommandHelp(interaction, command);
    }

    const embed = new EmbedBuilder()
      .setTitle("🤖 RoleReactor Bot Help")
      .setDescription(
        "Welcome to **RoleReactor Bot** - The professional Discord role management solution!\n\n" +
          "This bot allows users to self-assign roles by reacting to messages with emojis."
      )
      .setColor(0x0099ff)
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({
        text: "RoleReactor Bot v1.0.0 • Role Management System",
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
          2
        )} MB`,
      ].join("\n"),
      inline: true,
    });

    // Available Commands
    embed.addFields({
      name: "🔧 Available Commands",
      value: [
        "`/setup-roles` - Create role-reaction messages",
        "`/remove-roles` - Remove role mappings",
        "`/help` - Show this help message",
      ].join("\n"),
      inline: true,
    });

    // Quick Start Guide
    embed.addFields({
      name: "🚀 Quick Start",
      value: [
        "1. Use `/setup-roles` to create a role message",
        "2. Users react to get roles automatically",
        "3. Remove reactions to lose roles",
        "4. Manage with `/remove-roles` when needed",
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
        "📊 **Role Categories** - Organize roles logically",
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
        .setStyle(ButtonStyle.Link)
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
          "**roles** - Role-emoji pairs (format: emoji:role,emoji:role)",
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

    case "remove-roles":
      embed.addFields({
        name: "📝 Usage",
        value: "`/remove-roles message_id:123456789012345678`",
        inline: false,
      });
      embed.addFields({
        name: "📋 Parameters",
        value: "**message_id** - The ID of the role-reaction message to remove",
        inline: false,
      });
      embed.addFields({
        name: "🔐 Permissions Required",
        value: "• Manage Roles (User)\n• Manage Messages (Bot)",
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
