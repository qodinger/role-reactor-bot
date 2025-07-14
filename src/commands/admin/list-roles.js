import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { hasAdminPermissions } from "../../utils/permissions.js";
import { getAllRoleMappings } from "../../utils/roleManager.js";
import { THEME_COLOR } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";

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
  const logger = getLogger();

  // Debug logging to help diagnose issues
  logger.debug("DEBUG: /list-roles called");
  logger.debug("guildId:", { guildId: interaction.guild?.id });
  const start = Date.now();

  try {
    // Check if already replied to prevent double responses
    if (interaction.replied || interaction.deferred) {
      logger.debug("Interaction already handled, skipping");
      return;
    }

    // Defer the reply first
    await interaction.deferReply({ flags: 64 }); // 64 = ephemeral flag

    if (!hasAdminPermissions(interaction.member)) {
      return interaction.editReply({
        content: "❌ You need administrator permissions to use this command!",
        flags: 64,
      });
    }

    const allMappings = await getAllRoleMappings();
    logger.debug("Retrieved mappings", {
      count: Object.keys(allMappings).length,
    });

    const guildMappings = Object.entries(allMappings).filter(
      ([, mapping]) => mapping.guildId === interaction.guild.id,
    );

    logger.debug("Guild mappings found", { count: guildMappings.length });

    if (guildMappings.length === 0) {
      return interaction.editReply({
        content: "❌ No role-reaction messages found in this server.",
        flags: 64,
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
        text: "Role Reactor • Role Management",
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
      flags: 64,
    });
    logger.info(`list-roles command completed in ${Date.now() - start}ms`);
  } catch (error) {
    logger.error("Error listing roles", error);

    // Only try to reply if we haven't already
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content:
            "❌ **Error**\nAn error occurred while listing the role-reaction messages. Please try again.",
          flags: 64,
        });
      } else if (interaction.deferred) {
        try {
          await interaction.editReply({
            content:
              "❌ **Error**\nAn error occurred while listing the role-reaction messages. Please try again.",
            flags: 64,
          });
        } catch (editError) {
          // If editReply fails due to unknown interaction, send a follow-up
          if (
            editError.code === 10062 ||
            (editError.rawError &&
              editError.rawError.message === "Unknown interaction")
          ) {
            try {
              await interaction.followUp({
                content:
                  "❌ **Error**\nAn error occurred while listing the role-reaction messages. Please try again.",
                flags: 64,
              });
            } catch (followUpError) {
              logger.error(
                "Failed to send follow-up error response",
                followUpError,
              );
            }
          } else {
            logger.error("Failed to send error response", editError);
          }
        }
      }
    } catch (replyError) {
      logger.error("Failed to send error response", replyError);
    }
  }
}
