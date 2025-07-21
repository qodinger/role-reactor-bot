import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import {
  hasAdminPermissions,
  botHasRequiredPermissions,
  getMissingBotPermissions,
  formatPermissionName,
} from "../../utils/discord/permissions.js";
import {
  removeTemporaryRole,
  getUserTemporaryRoles,
} from "../../utils/discord/temporaryRoles.js";
import { THEME_COLOR } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("remove-temp-role")
  .setDescription("Remove a temporary role from a user before it expires")
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("The user to remove the temporary role from")
      .setRequired(true),
  )
  .addRoleOption(option =>
    option
      .setName("role")
      .setDescription("The temporary role to remove")
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName("reason")
      .setDescription("Reason for removing the temporary role")
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

// Validate if a role is a temporary role for a user
export async function validateTemporaryRole(roleData) {
  const logger = getLogger();

  try {
    const tempRoles = await getUserTemporaryRoles(
      roleData.guildId,
      roleData.userId,
    );
    const tempRole = tempRoles.find(tr => tr.roleId === roleData.roleId);

    if (!tempRole) {
      return false;
    }

    // Check if the role has expired
    const now = new Date();
    const expiresAt = new Date(tempRole.expiresAt);
    if (expiresAt < now) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error validating temporary role", error);
    return false;
  }
}

// Remove role from user
export async function removeRoleFromUser(member, roleId) {
  const logger = getLogger();

  try {
    const role = member.guild.roles.cache.get(roleId);
    if (!role) {
      return false;
    }

    if (!member.roles.cache.has(roleId)) {
      return false;
    }

    await member.roles.remove(role);
    return true;
  } catch (error) {
    logger.error("Error removing role from user", error);
    return false;
  }
}

// Remove temporary role data
export async function removeTemporaryRoleData(roleData) {
  const logger = getLogger();

  try {
    await removeTemporaryRole(
      roleData.guildId,
      roleData.userId,
      roleData.roleId,
    );
    return true;
  } catch (error) {
    logger.error("Error removing temporary role data", error);
    return false;
  }
}

export async function execute(interaction, client) {
  await interaction.deferReply({ flags: 64 });
  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.editReply({
        content:
          "❌ **Permission Denied**\nYou need administrator permissions to use this command.",
        flags: 64,
      });
    }
    if (!botHasRequiredPermissions(interaction.guild)) {
      const missingPermissions = getMissingBotPermissions(interaction.guild);
      const permissionNames = missingPermissions
        .map(formatPermissionName)
        .join(", ");
      return interaction.editReply({
        content: `❌ **Missing Bot Permissions**\nI need the following permissions: **${permissionNames}**\n\nPlease ensure I have the required permissions and try again.`,
        flags: 64,
      });
    }
    const targetUser = interaction.options.getUser("user");
    const targetRole = interaction.options.getRole("role");
    const reason =
      interaction.options.getString("reason") || "No reason provided";
    const botMember = await interaction.guild.members.fetchMe();
    if (targetRole.position >= botMember.roles.highest.position) {
      return interaction.editReply({
        content: `❌ **Role Too High**\nI cannot manage the **${targetRole.name}** role because it's higher than my highest role.\n\n**How to fix:** Move my highest role above the target role in your server's role settings (Server Settings > Roles).`,
        flags: 64,
      });
    }
    if (targetRole.position >= interaction.member.roles.highest.position) {
      return interaction.editReply({
        content: `❌ **Role Too High**\nYou cannot manage the **${targetRole.name}** role because it's higher than your highest role.`,
        flags: 64,
      });
    }
    const targetMember = await interaction.guild.members.fetch(targetUser.id);
    if (!targetMember) {
      return interaction.editReply({
        content:
          "❌ **User Not Found**\nThe specified user is not a member of this server.",
        flags: 64,
      });
    }
    const hasRole = targetMember.roles.cache.has(targetRole.id);
    if (!hasRole) {
      return interaction.editReply({
        content: `❌ **User Doesn't Have Role**\n${targetUser} doesn't have the **${targetRole.name}** role.`,
        flags: 64,
      });
    }
    const tempRoles = await getUserTemporaryRoles(
      interaction.guild.id,
      targetUser.id,
    );
    const tempRole = tempRoles.find(tr => tr.roleId === targetRole.id);
    if (!tempRole) {
      return interaction.editReply({
        content: `❌ **Not a Temporary Role**\nThe **${targetRole.name}** role is not a temporary role for ${targetUser}.`,
        flags: 64,
      });
    }
    await targetMember.roles.remove(
      targetRole,
      `Temporary role removed by ${interaction.user.tag}: ${reason}`,
    );
    await removeTemporaryRole(
      interaction.guild.id,
      targetUser.id,
      targetRole.id,
    );
    const embed = new EmbedBuilder()
      .setTitle("✅ Temporary Role Removed!")
      .setDescription(
        `Successfully removed **${targetRole.name}** from ${targetUser}`,
      )
      .setColor(THEME_COLOR)
      .setTimestamp()
      .setFooter({
        text: "Role Reactor • Temporary Roles",
        iconURL: client.user.displayAvatarURL(),
      });
    embed.addFields(
      {
        name: "👤 User",
        value: `${targetUser} (${targetUser.tag})`,
        inline: true,
      },
      {
        name: "🎭 Role",
        value: `${targetRole} (${targetRole.name})`,
        inline: true,
      },
      {
        name: "📝 Reason",
        value: reason,
        inline: false,
      },
      {
        name: "👮 Removed By",
        value: `${interaction.user} (${interaction.user.tag})`,
        inline: false,
      },
    );
    await interaction.editReply({
      embeds: [embed],
      flags: 64,
    });
    try {
      const userEmbed = new EmbedBuilder()
        .setTitle("🎭 Temporary Role Removed!")
        .setDescription(
          `Your **${targetRole.name}** role has been removed from **${interaction.guild.name}**`,
        )
        .setColor(THEME_COLOR)
        .setTimestamp()
        .setFooter({
          text: "Role Reactor • Temporary Roles",
          iconURL: client.user.displayAvatarURL(),
        });
      userEmbed.addFields(
        {
          name: "📝 Reason",
          value: reason,
          inline: false,
        },
        {
          name: "👮 Removed By",
          value: `${interaction.user} (${interaction.user.tag})`,
          inline: false,
        },
      );
      await targetUser.send({ embeds: [userEmbed] });
    } catch (error) {
      const logger = getLogger();
      logger.warn(`Could not send DM to ${targetUser.tag}`, {
        error: error.message,
      });
    }
  } catch (error) {
    const logger = getLogger();
    logger.error("Error removing temporary role", error);
    await interaction.editReply({
      content:
        "❌ **Error**\nAn error occurred while removing the temporary role. Please try again.",
      flags: 64,
    });
  }
}
