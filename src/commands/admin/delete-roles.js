import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../utils/discord/permissions.js";
import {
  removeRoleMapping,
  getRoleMapping,
} from "../../utils/discord/roleMappingManager.js";
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
        permissionErrorEmbed({
          requiredPermissions: ["Administrator"],
          userPermissions: interaction.member.permissions.toArray(),
          tip: "You need Administrator permissions to delete role-reaction messages.",
        }),
      );
    }

    const messageId = interaction.options.getString("message_id");

    // Validate message ID format
    if (!/^\d{17,19}$/.test(messageId)) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Message ID",
          description:
            "The message ID you provided doesn't look like a valid Discord message ID.",
          solution:
            "Please provide a valid message ID. You can get this from `/list-roles` or by right-clicking the message and selecting 'Copy Message ID'.",
          fields: [
            {
              name: "🔍 How to Get Message ID",
              value:
                "• Use `/list-roles` to see all role messages with their IDs\n• Right-click the message → 'Copy Message ID'\n• Enable Developer Mode in Discord settings first",
              inline: false,
            },
            {
              name: "📝 Example",
              value: "Message ID should look like: `1234567890123456789`",
              inline: false,
            },
          ],
        }),
      );
    }

    // Check if the role mapping exists
    const roleMapping = await getRoleMapping(messageId, interaction.guild.id);

    if (!roleMapping) {
      return interaction.editReply(
        errorEmbed({
          title: "Message Not Found",
          description:
            "I couldn't find a role-reaction message with that ID in this server.",
          solution:
            "Please check the message ID and try again. You can use `/list-roles` to see all available role messages.",
          fields: [
            {
              name: "🔍 Troubleshooting",
              value:
                "• Make sure the message ID is correct\n• Check that the message is in this server\n• Use `/list-roles` to see all role messages",
              inline: false,
            },
            {
              name: "💡 Tip",
              value:
                "The message might have been deleted already, or it's not a role-reaction message.",
              inline: false,
            },
          ],
        }),
      );
    }

    // Try to find the message in the channel
    let message = null;
    try {
      const channel = interaction.guild.channels.cache.get(
        roleMapping.channelId,
      );
      if (channel) {
        message = await channel.messages.fetch(messageId).catch(() => null);
      }
    } catch (error) {
      logger.error("Error fetching message", {
        messageId,
        error: error.message,
      });
    }

    // Remove the role mapping from storage
    await removeRoleMapping(messageId, interaction.guild.id);

    // Try to delete the message if it exists
    let messageDeleted = false;
    if (message) {
      try {
        await message.delete();
        messageDeleted = true;
      } catch (error) {
        logger.error("Error deleting message", {
          messageId,
          error: error.message,
        });
      }
    }

    // Prepare response
    await interaction.editReply(
      roleDeletedEmbed({
        messageId,
        rolesRemoved: Object.keys(roleMapping.roles || {}).length,
        messageDeleted,
      }),
    );

    logger.logCommand("delete-roles", interaction.user.id, Date.now(), true);
  } catch (error) {
    logger.error("Error deleting roles", error);
    logger.logCommand("delete-roles", interaction.user.id, Date.now(), false);

    await interaction.editReply(
      errorEmbed({
        title: "Deletion Failed",
        description:
          "Something went wrong while trying to delete the role-reaction message.",
        solution:
          "Please try again in a moment. If the problem persists, check that I have the necessary permissions.",
        fields: [
          {
            name: "🔧 Quick Fix",
            value:
              "• Make sure I have 'Manage Messages' permission\n• Check that the message still exists\n• Verify your internet connection is stable",
            inline: false,
          },
        ],
      }),
    );
  }
}
