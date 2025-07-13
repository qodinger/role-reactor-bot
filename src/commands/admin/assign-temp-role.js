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
} from "../../utils/permissions.js";
import {
  addTemporaryRole,
  parseDuration,
  formatDuration,
} from "../../utils/temporaryRoles.js";
import { THEME_COLOR } from "../../config/theme.js";

export const data = new SlashCommandBuilder()
  .setName("assign-temp-role")
  .setDescription(
    "Assign a temporary role to a user that expires after a set time",
  )
  .addUserOption(option =>
    option
      .setName("user")
      .setDescription("The user to assign the temporary role to")
      .setRequired(true),
  )
  .addRoleOption(option =>
    option
      .setName("role")
      .setDescription("The role to assign temporarily")
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName("duration")
      .setDescription("How long the role should last (e.g., 1h, 2d, 1w, 30m)")
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName("reason")
      .setDescription("Reason for assigning the temporary role")
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

// Validate if a role can be assigned
export function validateRole(role) {
  // Don't assign managed roles (bot roles, integration roles, etc.)
  if (role.managed) {
    return false;
  }

  // Don't assign bot roles
  if (role.tags && role.tags.botId) {
    return false;
  }

  return true;
}

// Store temporary role data
export async function storeTemporaryRole(roleData) {
  try {
    await addTemporaryRole(
      roleData.guildId,
      roleData.userId,
      roleData.roleId,
      roleData.expiresAt,
    );
    return true;
  } catch (error) {
    console.error("Error storing temporary role:", error);
    return false;
  }
}

// Validate duration string
export function validateDuration(durationStr) {
  try {
    const expiresAt = parseDuration(durationStr);
    const now = new Date();
    const maxDuration = new Date();
    maxDuration.setFullYear(maxDuration.getFullYear() + 1);

    // Check if duration is too long (more than 1 year)
    if (expiresAt > maxDuration) {
      return false;
    }

    // Check if duration is too short (less than 5 minutes)
    const minDuration = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
    if (expiresAt < minDuration) {
      return false;
    }

    return true;
  } catch {
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
    const durationStr = interaction.options.getString("duration");
    const reason =
      interaction.options.getString("reason") || "No reason provided";
    if (targetUser.bot) {
      return interaction.editReply({
        content: "❌ **Invalid Target**\nYou cannot assign roles to bots.",
        flags: 64,
      });
    }
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
    let expiresAt;
    try {
      const durationMs = parseDuration(durationStr);
      if (!durationMs || isNaN(durationMs)) {
        return interaction.editReply({
          content: `❌ **Invalid Duration Format**\n\n**Valid formats:**\n• \`30m\` - 30 minutes\n• \`2h\` - 2 hours\n• \`1d\` - 1 day\n• \`1w\` - 1 week\n• \`1h30m\` - 1 hour 30 minutes`,
          flags: 64,
        });
      }
      expiresAt = new Date(Date.now() + durationMs);
    } catch (error) {
      return interaction.editReply({
        content: `❌ **Invalid Duration Format**\n\n**Valid formats:**\n• \`30m\` - 30 minutes\n• \`2h\` - 2 hours\n• \`1d\` - 1 day\n• \`1w\` - 1 week\n• \`1h30m\` - 1 hour 30 minutes\n\n**Error:** ${error.message}`,
        flags: 64,
      });
    }
    const maxDuration = new Date();
    maxDuration.setFullYear(maxDuration.getFullYear() + 1);
    if (expiresAt > maxDuration) {
      return interaction.editReply({
        content:
          "❌ **Duration Too Long**\nThe maximum duration for temporary roles is 1 year.",
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
    const alreadyHasRole = targetMember.roles.cache.has(targetRole.id);
    if (alreadyHasRole) {
      return interaction.editReply({
        content: `❌ **User Already Has Role**\n${targetUser} already has the **${targetRole.name}** role.`,
        flags: 64,
      });
    }
    await targetMember.roles.add(
      targetRole,
      `Temporary role assigned by ${interaction.user.tag}: ${reason}`,
    );
    // Ensure expiresAt is a Date object before calling toISOString
    if (!(expiresAt instanceof Date)) {
      expiresAt = new Date(expiresAt);
    }
    await addTemporaryRole(
      interaction.guild.id,
      targetUser.id,
      targetRole.id,
      expiresAt.toISOString(),
    );
    const embed = new EmbedBuilder()
      .setTitle("✅ Temporary Role Assigned!")
      .setDescription(
        `Successfully assigned **${targetRole.name}** to ${targetUser}`,
      )
      .setColor(THEME_COLOR)
      .setTimestamp()
      .setFooter({
        text: "RoleReactor • Temporary Roles",
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
        name: "⏰ Duration",
        value: formatDuration(durationStr),
        inline: true,
      },
      {
        name: "🕐 Expires At",
        value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>\n(<t:${Math.floor(expiresAt.getTime() / 1000)}:R>)`,
        inline: false,
      },
      {
        name: "📝 Reason",
        value: reason,
        inline: false,
      },
      {
        name: "👮 Assigned By",
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
        .setTitle("🎭 Temporary Role Assigned!")
        .setDescription(
          `You've been assigned the **${targetRole.name}** role in **${interaction.guild.name}**`,
        )
        .setColor(targetRole.color || THEME_COLOR)
        .setTimestamp()
        .setFooter({
          text: "RoleReactor • Temporary Roles",
          iconURL: client.user.displayAvatarURL(),
        });
      userEmbed.addFields(
        {
          name: "⏰ Duration",
          value: formatDuration(durationStr),
          inline: true,
        },
        {
          name: "🕐 Expires At",
          value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>\n(<t:${Math.floor(expiresAt.getTime() / 1000)}:R>)`,
          inline: true,
        },
        {
          name: "📝 Reason",
          value: reason,
          inline: false,
        },
        {
          name: "👮 Assigned By",
          value: `${interaction.user} (${interaction.user.tag})`,
          inline: false,
        },
      );
      await targetUser.send({ embeds: [userEmbed] });
    } catch (error) {
      // User might have DMs disabled, that's okay
      console.log(`Could not send DM to ${targetUser.tag}: ${error.message}`);
    }
  } catch (error) {
    console.error("Error assigning temporary role:", error);
    await interaction.editReply({
      content:
        "❌ **Error**\nAn error occurred while assigning the temporary role. Please try again.",
      flags: 64,
    });
  }
}

// Re-export utility functions for tests
export { parseDuration, formatDuration, addTemporaryRole };
