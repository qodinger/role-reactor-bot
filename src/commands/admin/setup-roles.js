import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import {
  hasAdminPermissions,
  botHasRequiredPermissions,
  getMissingBotPermissions,
  formatPermissionName,
} from "../../utils/permissions.js";
import { setRoleMapping, parseRoleString } from "../../utils/roleManager.js";
import {
  titleOption,
  descriptionOption,
  rolesOption,
  colorOption,
} from "../../utils/roleMessageOptions.js";

export default {
  data: new SlashCommandBuilder()
    .setName("setup-roles")
    .setDescription("Create a role-reaction message for self-assignable roles")
    .addStringOption(titleOption().setRequired(true))
    .addStringOption(descriptionOption().setRequired(true))
    .addStringOption(rolesOption(true))
    .addStringOption(colorOption())
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction, client) {
    // Defer reply for better UX
    await interaction.deferReply({ ephemeral: true });

    try {
      // Check user permissions
      if (!hasAdminPermissions(interaction.member)) {
        return interaction.editReply({
          content:
            "❌ **Permission Denied**\nYou need administrator permissions to use this command.",
          ephemeral: true,
        });
      }

      // Check bot permissions
      if (!botHasRequiredPermissions(interaction.guild)) {
        const missingPermissions = getMissingBotPermissions(interaction.guild);
        const permissionNames = missingPermissions
          .map(formatPermissionName)
          .join(", ");

        return interaction.editReply({
          content: `❌ **Missing Bot Permissions**\nI need the following permissions: **${permissionNames}**\n\nPlease ensure I have the required permissions and try again.`,
          ephemeral: true,
        });
      }

      const title = interaction.options.getString("title");
      const description = interaction.options.getString("description");
      const rolesString = interaction.options.getString("roles");
      const colorHex = interaction.options.getString("color") || "#0099ff";

      // Validate color hex
      const color = colorHex.startsWith("#") ? colorHex : `#${colorHex}`;
      if (!/^#[0-9A-F]{6}$/i.test(color)) {
        return interaction.editReply({
          content:
            "❌ **Invalid Color Format**\nPlease provide a valid hex color code (e.g., #0099ff or 0099ff)",
          ephemeral: true,
        });
      }

      // Parse role-emoji pairs (flat)
      const { roles, errors: parseErrors } = parseRoleString(rolesString);
      const roleMapping = {};
      const validPairs = [];
      const errors = [...parseErrors];

      // Fetch the bot's member object and highest role
      const botMember = await interaction.guild.members.fetchMe();
      const botHighestRole = botMember.roles.highest;

      for (const { emoji, roleName } of roles) {
        // Check if role exists
        const role = interaction.guild.roles.cache.find(
          r => r.name.toLowerCase() === roleName.toLowerCase(),
        );
        if (!role) {
          errors.push(`❌ Role "${roleName}" not found in this server`);
          continue;
        }

        // Check if the bot can manage this role
        if (role.position >= botHighestRole.position) {
          errors.push(
            `❌ Cannot manage role "${roleName}" - it's higher than my highest role`,
          );
          continue;
        }

        // Check for duplicate emojis
        if (roleMapping[emoji]) {
          errors.push(`❌ Duplicate emoji "${emoji}" found`);
          continue;
        }

        roleMapping[emoji] = roleName;
        validPairs.push({ emoji, roleName, role });
      }

      // Show errors if any
      if (errors.length > 0) {
        const errorEmbed = new EmbedBuilder()
          .setTitle("❌ Setup Errors")
          .setDescription("The following errors were found:")
          .setColor(0xff0000)
          .setTimestamp()
          .setFooter({
            text: "RoleReactor Bot • Setup",
            iconURL: client.user.displayAvatarURL(),
          });

        // Split errors into chunks if too long
        const errorChunks = [];
        for (let i = 0; i < errors.length; i += 10) {
          errorChunks.push(errors.slice(i, i + 10));
        }

        errorChunks.forEach((chunk, index) => {
          errorEmbed.addFields({
            name: index === 0 ? "Errors" : "Errors (continued)",
            value: chunk.join("\n"),
            inline: false,
          });
        });

        return interaction.editReply({
          embeds: [errorEmbed],
          ephemeral: true,
        });
      }

      if (validPairs.length === 0) {
        return interaction.editReply({
          content:
            "❌ **No Valid Role-Emoji Pairs**\nPlease provide at least one valid role-emoji pair.",
          ephemeral: true,
        });
      }

      // Create embed message
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp()
        .setFooter({
          text: `RoleReactor Bot • ${interaction.guild.name}`,
          iconURL: client.user.displayAvatarURL(),
        })
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }));

      // Add roles as a single field
      embed.addFields({
        name: "Roles",
        value: validPairs
          .map(({ emoji, roleName }) => `${emoji} **${roleName}**`)
          .join("\n"),
        inline: false,
      });

      // Add instructions
      embed.addFields({
        name: "📋 Instructions",
        value: "React to this message to get or remove roles automatically!",
        inline: false,
      });

      // Send the message
      const message = await interaction.channel.send({ embeds: [embed] });

      // Add reactions with progress indication
      const reactionProgress = new EmbedBuilder()
        .setTitle("⏳ Adding Reactions...")
        .setDescription(
          `Adding ${validPairs.length} reactions to the message...`,
        )
        .setColor(0xffff00)
        .setTimestamp();

      await interaction.editReply({ embeds: [reactionProgress] });

      // Add reactions
      for (const { emoji } of validPairs) {
        await message.react(emoji);
        // Small delay to avoid rate limiting
        await new Promise(resolve => {
          setTimeout(resolve, 500);
        });
      }

      // Store the role mapping
      await setRoleMapping(message.id, roleMapping);

      // Success embed
      const successEmbed = new EmbedBuilder()
        .setTitle("✅ Role-Reaction Message Created!")
        .setDescription(
          "Your role-reaction message has been successfully created.",
        )
        .setColor(0x00ff00)
        .setTimestamp()
        .setFooter({
          text: "RoleReactor Bot • Setup Complete",
          iconURL: client.user.displayAvatarURL(),
        });

      successEmbed.addFields({
        name: "📊 Setup Summary",
        value: [
          `**Message ID:** ${message.id}`,
          `**Roles Added:** ${validPairs.length}`,
          `**Channel:** ${interaction.channel}`,
          `**Created by:** ${interaction.user.tag}`,
        ].join("\n"),
        inline: false,
      });

      // Create management buttons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("View Message")
          .setURL(message.url)
          .setStyle(ButtonStyle.Link),
        new ButtonBuilder()
          .setLabel("Remove Setup")
          .setCustomId(`remove_roles_${message.id}`)
          .setStyle(ButtonStyle.Danger),
      );

      await interaction.editReply({
        embeds: [successEmbed],
        components: [row],
      });
    } catch (error) {
      console.error("Error in setup-roles command:", error);

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Setup Failed")
        .setDescription(
          "An unexpected error occurred while setting up the role-reaction message.",
        )
        .setColor(0xff0000)
        .setTimestamp()
        .setFooter({
          text: "RoleReactor Bot • Error",
          iconURL: client.user.displayAvatarURL(),
        });

      errorEmbed.addFields({
        name: "🔧 Troubleshooting",
        value: [
          "• Check that I have the required permissions",
          "• Ensure the roles exist and are manageable",
          "• Verify the emoji format is correct",
          "• Try again in a few moments",
        ].join("\n"),
        inline: false,
      });

      await interaction.editReply({
        embeds: [errorEmbed],
        ephemeral: true,
      });
    }
  },
};
