import { getLogger } from "../../../utils/logger.js";
import {
  removeRoleMapping,
  getRoleMapping,
} from "../../../utils/discord/roleMappingManager.js";
import {
  roleDeletedEmbed,
  errorEmbed,
} from "../../../utils/discord/responseMessages.js";
import { validateMessageId, validateRoleMapping } from "./utils.js";

/**
 * Handle the main delete roles logic
 * @param {import('discord.js').CommandInteraction} interaction
 */
export async function handleDeleteRoles(interaction) {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: 64 });

    const messageId = interaction.options.getString("message_id");

    // Validate message ID format
    if (!validateMessageId(messageId)) {
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

    if (!validateRoleMapping(roleMapping)) {
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
