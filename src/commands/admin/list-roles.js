import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { hasAdminPermissions } from "../../utils/permissions.js";
import { getAllRoleMappings } from "../../utils/roleManager.js";
import { THEME_COLOR } from "../../config/theme.js";

export const data = new SlashCommandBuilder()
  .setName("list-roles")
  .setDescription("List all role-reaction messages in this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

// Format role information for display
export function formatRoleInfo(role) {
  const color = role.color
    ? `#${role.color.toString(16).padStart(6, "0")}`
    : "No color";
  return `${role.name} (${color})`;
}

// Filter roles by name
export function filterRoles(roles, searchTerm) {
  if (!searchTerm) {
    return roles;
  }

  const term = searchTerm.toLowerCase();
  return roles.filter(role => role.name.toLowerCase().includes(term));
}

export async function execute(interaction, client) {
  // Debug logging to help diagnose issues
  console.log("DEBUG: /list-roles called");
  console.log("guildId:", interaction.guild?.id);
  console.log("roleMappings:", JSON.stringify(global.roleMappings, null, 2));

  await interaction.deferReply({ ephemeral: true });
  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.editReply({
        content: "❌ You need administrator permissions to use this command!",
        ephemeral: true,
      });
    }
    const allMappings = await getAllRoleMappings();
    const guildMappings = Object.entries(allMappings).filter(
      ([, mapping]) => mapping.guildId === interaction.guild.id,
    );
    if (guildMappings.length === 0) {
      return interaction.editReply({
        content: "❌ No role-reaction messages found in this server.",
        ephemeral: true,
      });
    }
    const embed = new EmbedBuilder()
      .setTitle("🎭 Role-Reaction Messages")
      .setDescription(
        `Found **${guildMappings.length}** role-reaction message(s) in this server.`,
      )
      .setColor(THEME_COLOR)
      .setTimestamp()
      .setFooter({
        text: "RoleReactor • Role Management",
        iconURL: client.user.displayAvatarURL(),
      });
    const roleList = guildMappings
      .map(([messageId, mapping]) => {
        const roleCount = Object.keys(mapping.roles || {}).length;
        return `**Message ID:** ${messageId}\n**Roles:** ${roleCount} role(s)`;
      })
      .join("\n\n");
    embed.addFields({
      name: "📋 Messages",
      value: roleList,
      inline: false,
    });
    await interaction.editReply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    console.error("Error listing roles:", error);
    await interaction.editReply({
      content:
        "❌ **Error**\nAn error occurred while listing the role-reaction messages. Please try again.",
      ephemeral: true,
    });
  }
}
