const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { hasAdminPermissions } = require("../../utils/permissions");
const {
  removeRoleMapping,
  getRoleMapping,
} = require("../../utils/roleManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remove-roles")
    .setDescription("Remove a role-reaction message")
    .addStringOption((option) =>
      option
        .setName("message_id")
        .setDescription("The ID of the message to remove")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction, client) {
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
      } catch (error) {
        // Message might not exist anymore, that's okay
        console.log(`Message ${messageId} not found or already deleted`);
      }

      // Remove the role mapping
      await removeRoleMapping(messageId);

      await interaction.reply({
        content: `✅ Role-reaction message removed successfully!`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error removing role-reaction message:", error);
      await interaction.reply({
        content:
          "❌ An error occurred while removing the role-reaction message",
        ephemeral: true,
      });
    }
  },
};
