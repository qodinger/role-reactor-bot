import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "@/utils/permissions.js";
import { removeRoleMapping, getRoleMapping } from "@/utils/roleManager.js";

export default {
  data: new SlashCommandBuilder()
    .setName("remove-role-message")
    .setDescription("Remove a role-reaction message by message ID")
    .addStringOption(option =>
      option
        .setName("message_id")
        .setDescription("The ID of the message to remove")
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    // Check user permissions
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.reply({
        content: "❌ You need administrator permissions to use this command!",
        ephemeral: true,
      });
    }

    const messageId = interaction.options.getString("message_id");

    try {
      // Check if the message exists and has role mappings
      const roleMapping = await getRoleMapping(messageId);

      if (!roleMapping) {
        return interaction.reply({
          content: "❌ No role-reaction message found with that ID",
          ephemeral: true,
        });
      }

      // Try to delete the message
      try {
        const channel = interaction.channel;
        const message = await channel.messages.fetch(messageId);
        await message.delete();
      } catch {
        // Message might not exist anymore, that's okay
        console.log(`Message ${messageId} not found or already deleted`);
      }

      // Remove the role mapping
      await removeRoleMapping(messageId);

      await interaction.reply({
        content: "✅ Role-reaction message removed successfully!",
        ephemeral: true,
      });
    } catch {
      console.error("Error removing role-reaction message:");
      await interaction.reply({
        content:
          "❌ An error occurred while removing the role-reaction message",
        ephemeral: true,
      });
    }
  },
};
