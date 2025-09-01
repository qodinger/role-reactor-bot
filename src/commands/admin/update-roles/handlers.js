import { getLogger } from "../../../utils/logger.js";
import {
  getRoleMapping,
  setRoleMapping,
} from "../../../utils/discord/roleMappingManager.js";
import { processRoles } from "../../../utils/discord/roleManager.js";
import {
  roleUpdatedEmbed,
  errorEmbed,
} from "../../../utils/discord/responseMessages.js";
import { validateMessageId, validateColor, processUpdates } from "./utils.js";
import { createUpdatedRolesEmbed } from "./embeds.js";

/**
 * Handle the main update roles logic
 * @param {import('discord.js').CommandInteraction} interaction
 */
export async function handleUpdateRoles(interaction) {
  const logger = getLogger();

  try {
    await interaction.deferReply({ flags: 64 });

    const messageId = interaction.options.getString("message_id");
    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");
    const rolesString = interaction.options.getString("roles");
    const colorHex = interaction.options.getString("color");

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

    const existingMapping = await getRoleMapping(
      messageId,
      interaction.guild.id,
    );
    if (!existingMapping) {
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

    const updates = {};
    if (title) updates.title = title;
    if (description) updates.description = description;

    let roleMapping = existingMapping.roles;
    if (rolesString) {
      const roleProcessingResult = await processRoles(
        rolesString,
        interaction.guild,
      );
      if (!roleProcessingResult.success) {
        return interaction.editReply(
          errorEmbed({
            title: "Role Processing Error",
            description: roleProcessingResult.error,
            solution: "Please check your role format and try again.",
            fields: [
              {
                name: "📝 Correct Format",
                value:
                  "`emoji:role,emoji:role`\nExample: `🎮:Gamer,🎨:Artist,💻:Developer`",
                inline: false,
              },
              {
                name: "🔍 Common Issues",
                value:
                  "• Make sure roles exist in your server\n• Use valid emojis (🎮, 🎨, etc.)\n• Separate roles with commas\n• Don't use spaces around the colon",
                inline: false,
              },
            ],
          }),
        );
      }
      roleMapping = roleProcessingResult.roleMapping;
      updates.roles = roleMapping;
    }

    if (colorHex) {
      if (!validateColor(colorHex)) {
        return interaction.editReply(
          errorEmbed({
            title: "Invalid Color Format",
            description: "The color you provided isn't in the correct format.",
            solution: "Please provide a valid hex color code.",
            fields: [
              {
                name: "📝 Correct Format",
                value:
                  "Use hex color codes like:\n• `#0099ff` (with #)\n• `0099ff` (without #)\n• `#ff0000` for red\n• `#00ff00` for green",
                inline: false,
              },
              {
                name: "🎨 Color Examples",
                value:
                  "• Blue: `#0099ff`\n• Red: `#ff0000`\n• Green: `#00ff00`\n• Purple: `#800080`\n• Orange: `#ffa500`",
                inline: false,
              },
            ],
          }),
        );
      }
      updates.color = processUpdates.formatColor(colorHex);
    }

    // Merge updates into existing mapping
    const updatedMapping = { ...existingMapping, ...updates };

    // Update the original message if possible
    const channel = await interaction.guild.channels.fetch(
      existingMapping.channelId,
    );
    const message = await channel.messages.fetch(messageId);

    // Create updated embed
    const embed = createUpdatedRolesEmbed(
      updatedMapping,
      roleMapping,
      interaction.client,
    );

    await message.edit({ embeds: [embed] });

    // Save the updated mapping using the correct signature
    await setRoleMapping(
      messageId,
      updatedMapping.guildId,
      updatedMapping.channelId,
      roleMapping,
    );

    await interaction.editReply(
      roleUpdatedEmbed({
        messageId,
        updates: Object.keys(updates).join(", "),
        changeCount: Object.keys(updates).length,
      }),
    );
  } catch (error) {
    logger.error("Error updating roles", error);
    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description:
          "An error occurred while updating the role-reaction message. Please try again.",
      }),
    );
  }
}
