import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../utils/permissions.js";
import { removeRoleMapping, getRoleMapping } from "../../utils/roleManager.js";

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
  try {
    // Check if already replied to prevent double responses
    if (interaction.replied || interaction.deferred) {
      console.log("Interaction already handled, skipping");
      return;
    }

    await interaction.deferReply({ flags: 64 });

    if (!hasAdminPermissions(interaction.member)) {
      return interaction.editReply({
        content: "❌ You need administrator permissions to use this command!",
        flags: 64,
      });
    }

    const messageId = interaction.options.getString("message_id");
    const roleMapping = await getRoleMapping(messageId);

    if (!roleMapping) {
      return interaction.editReply({
        content: "❌ No role-reaction message found with that ID.",
        flags: 64,
      });
    }

    await removeRoleMapping(messageId);

    await interaction.editReply({
      content: `✅ **Role-Reaction Message Deleted!**\n\n**Message ID:** ${messageId}\n\nThe role-reaction message has been removed from the database.`,
      flags: 64,
    });
  } catch (error) {
    console.error("Error deleting roles:", error);

    // Only try to reply if we haven't already
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content:
            "❌ **Error**\nAn error occurred while deleting the role-reaction message. Please try again.",
          flags: 64,
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          content:
            "❌ **Error**\nAn error occurred while deleting the role-reaction message. Please try again.",
          flags: 64,
        });
      }
    } catch (replyError) {
      console.error("Failed to send error response:", replyError);
    }
  }
}
