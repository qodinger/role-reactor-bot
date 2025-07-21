import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../utils/discord/permissions.js";
import {
  removeRoleMapping,
  getRoleMapping,
} from "../../utils/discord/roleManager.js";
import { getLogger } from "../../utils/logger.js";
import {
  roleDeletedEmbed,
  permissionErrorEmbed,
  errorEmbed,
} from "../../utils/discord/responseMessages.js";

export const data = new SlashCommandBuilder()
  .setName("delete-roles")
  .setDescription("Delete a role-reaction message")
  .addStringOption(option =>
    option
      .setName("message_id")
      .setDescription("The ID of the message to delete")
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

// Validate that a message exists in a channel
export async function validateMessage(channel, messageId) {
  try {
    const message = await channel.messages.fetch(messageId);
    return message;
  } catch {
    return null;
  }
}

// Extract role IDs from message reactions
export function extractRolesFromReactions(message) {
  const roles = [];
  if (!message.reactions || !message.reactions.cache) {
    return roles;
  }

  for (const reaction of message.reactions.cache.values()) {
    if (reaction.emoji && reaction.emoji.id) {
      // This is a custom emoji, we'd need to map it to a role
      // For now, just return empty array as this is a mock
      continue;
    }
  }

  return roles;
}

// Delete multiple roles from a guild
export async function deleteRoles(guild, roleIds) {
  const result = { success: 0, failed: 0 };

  for (const roleId of roleIds) {
    try {
      const role = guild.roles.cache.get(roleId);
      if (role && validateRoleForDeletion(role)) {
        await role.delete();
        result.success++;
      } else {
        result.failed++;
      }
    } catch {
      result.failed++;
    }
  }

  return result;
}

// Validate if a role can be deleted
export function validateRoleForDeletion(role) {
  // Don't delete managed roles (bot roles, integration roles, etc.)
  if (role.managed) {
    return false;
  }

  // Don't delete bot roles
  if (role.tags && role.tags.botId) {
    return false;
  }

  // Don't delete roles that are too high in the hierarchy
  // This is a simplified check - in reality you'd check against the bot's highest role
  if (role.position >= 100) {
    return false;
  }

  return true;
}

export async function execute(interaction) {
  const logger = getLogger();

  try {
    if (interaction.replied || interaction.deferred) {
      logger.debug("Interaction already handled, skipping");
      return;
    }

    await interaction.deferReply({ flags: 64 });

    if (!hasAdminPermissions(interaction.member)) {
      return interaction.editReply(
        permissionErrorEmbed({ requiredPermissions: ["Administrator"] }),
      );
    }

    const messageId = interaction.options.getString("message_id");
    const roleMapping = await getRoleMapping(messageId);

    if (!roleMapping) {
      return interaction.editReply(
        errorEmbed({
          title: "Message Not Found",
          description: "No role-reaction message found with that ID.",
          solution: "Use `/list-roles` to find the correct message ID.",
        }),
      );
    }

    await removeRoleMapping(messageId);

    await interaction.editReply(
      roleDeletedEmbed({
        messageId,
        rolesRemoved: Object.keys(roleMapping.roles || {}).length,
      }),
    );
  } catch (error) {
    logger.error("Error deleting roles", error);

    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(
          errorEmbed({
            title: "Error",
            description:
              "An error occurred while deleting the role-reaction message. Please try again.",
          }),
        );
      } else if (interaction.deferred) {
        await interaction.editReply(
          errorEmbed({
            title: "Error",
            description:
              "An error occurred while deleting the role-reaction message. Please try again.",
          }),
        );
      }
    } catch (replyError) {
      logger.error("Failed to send error response", replyError);
    }
  }
}
