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
import { THEME_COLOR } from "../../config/theme.js";

export const data = new SlashCommandBuilder()
  .setName("setup-roles")
  .setDescription("Create a role-reaction message for self-assignable roles")
  .addStringOption(titleOption().setRequired(true))
  .addStringOption(descriptionOption().setRequired(true))
  .addStringOption(rolesOption(true))
  .addStringOption(colorOption())
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction, client) {
  await interaction.deferReply({ ephemeral: true });
  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.editReply({
        content:
          "❌ **Permission Denied**\nYou need administrator permissions to use this command.",
        ephemeral: true,
      });
    }
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
    const colorHex = interaction.options.getString("color");
    let color = THEME_COLOR;
    if (colorHex) {
      const hex = colorHex.startsWith("#") ? colorHex : `#${colorHex}`;
      if (!/^#[0-9A-F]{6}$/i.test(hex)) {
        return interaction.editReply({
          content:
            "❌ **Invalid Color Format**\nPlease provide a valid hex color code (e.g., #0099ff or 0099ff)",
          ephemeral: true,
        });
      }
      color = hex;
    }
    const { roles, errors: parseErrors } = parseRoleString(rolesString);
    const roleMapping = {};
    const validPairs = [];
    const errors = [...parseErrors];
    const botMember = await interaction.guild.members.fetchMe();
    for (const roleConfig of roles) {
      const role = interaction.guild.roles.cache.find(
        r => r.name.toLowerCase() === roleConfig.roleName.toLowerCase(),
      );
      if (!role) {
        errors.push(`❌ Role "${roleConfig.roleName}" not found`);
        continue;
      }
      if (role.position >= botMember.roles.highest.position) {
        errors.push(
          `❌ Cannot manage role "${roleConfig.roleName}" - it's higher than my highest role`,
        );
        continue;
      }
      roleMapping[roleConfig.emoji] = roleConfig;
      validPairs.push({
        emoji: roleConfig.emoji,
        role: roleConfig.roleName,
        limit: roleConfig.limit,
      });
    }
    if (errors.length > 0) {
      return interaction.editReply({
        content: `❌ **Setup Errors**\n\n${errors.join("\n")}`,
        ephemeral: true,
      });
    }
    if (validPairs.length === 0) {
      return interaction.editReply({
        content: "❌ **No Valid Roles**\nNo valid roles were found to set up.",
        ephemeral: true,
      });
    }
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp()
      .setFooter({
        text: "RoleReactor • Self-Assignable Roles",
        iconURL: client.user.displayAvatarURL(),
      });
    const roleList = validPairs
      .map(pair => {
        const limitText = pair.limit ? ` (${pair.limit} users max)` : "";
        return `${pair.emoji} **${pair.role}**${limitText}`;
      })
      .join("\n");
    embed.addFields({
      name: "🎭 Available Roles",
      value: roleList,
      inline: false,
    });
    const rows = [];
    const buttonsPerRow = 5;
    for (let i = 0; i < validPairs.length; i += buttonsPerRow) {
      const row = new ActionRowBuilder();
      const rowPairs = validPairs.slice(i, i + buttonsPerRow);
      for (const pair of rowPairs) {
        const button = new ButtonBuilder()
          .setCustomId(`role_${pair.role}`)
          .setLabel(pair.role)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(pair.emoji);
        row.addComponents(button);
      }
      rows.push(row);
    }
    const message = await interaction.channel.send({
      embeds: [embed],
      components: rows,
    });
    await setRoleMapping(message.id, {
      guildId: interaction.guild.id,
      roles: roleMapping,
    });
    await interaction.editReply({
      content: `✅ **Role-Reaction Message Created!**\n\n**Message:** ${message.url}\n**Roles:** ${validPairs.length} role(s) set up\n\nUsers can now click the buttons to assign/remove roles.`,
      ephemeral: true,
    });
  } catch (error) {
    console.error("Error setting up roles:", error);
    await interaction.editReply({
      content:
        "❌ **Error**\nAn error occurred while setting up the role-reaction message. Please try again.",
      ephemeral: true,
    });
  }
}
