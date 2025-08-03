import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { hasAdminPermissions } from "../../utils/discord/permissions.js";
import { getAllRoleMappings } from "../../utils/discord/roleMappingManager.js";
import { THEME_COLOR } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";
import {
  errorEmbed,
  permissionErrorEmbed,
} from "../../utils/discord/responseMessages.js";

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
      return interaction.editReply(
        permissionErrorEmbed({
          requiredPermissions: ["Administrator"],
          userPermissions: interaction.member.permissions.toArray(),
          tip: "You need Administrator permissions to view role-reaction messages.",
        }),
      );
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
      return interaction.editReply(
        errorEmbed({
          title: "No Role-Reaction Messages Found",
          description:
            "There are no role-reaction messages set up in this server yet.",
          solution:
            "Use `/setup-roles` to create your first role-reaction message!",
          fields: [
            {
              name: "🎯 Getting Started",
              value:
                "Create role-reaction messages to let members self-assign roles with just a click!",
              inline: false,
            },
            {
              name: "📝 Quick Setup",
              value:
                '`/setup-roles title:"Choose Your Roles!" description:"Pick your roles!" roles:"🎮:Gamer,🎨:Artist"`',
              inline: false,
            },
          ],
        }),
      );
    }

    const embed = new EmbedBuilder()
      .setTitle("🎭 Role-Reaction Messages")
      .setDescription(
        `Found **${guildMappings.length}** role-reaction message${guildMappings.length !== 1 ? "s" : ""} in this server.`,
      )
      .setColor(THEME_COLOR)
      .setTimestamp()
      .setFooter({
        text: "Role Reactor • Click reactions to get roles!",
        iconURL: client.user.displayAvatarURL(),
      });

    const roleList = guildMappings
      .map(([messageId, mapping]) => {
        const rolesObj = mapping.roles || {};
        const rolesArr = Array.isArray(rolesObj)
          ? rolesObj
          : Object.values(rolesObj);
        const roleMentions = rolesArr
          .map(role =>
            role.roleId ? `<@&${role.roleId}>` : role.roleName || "Unknown",
          )
          .join(", ");
        // Channel mention (if available)
        const channelMention = mapping.channelId
          ? `<#${mapping.channelId}>`
          : "Unknown channel";
        return `**Message ID:** ${messageId}\n**Channel:** ${channelMention}\n**Roles:** ${rolesArr.length} role(s)\n${roleMentions}`;
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
