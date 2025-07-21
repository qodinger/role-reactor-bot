import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../utils/discord/permissions.js";
import {
  getRoleMapping,
  setRoleMapping,
} from "../../utils/discord/roleMappingManager.js";
import { processRoles } from "../../utils/discord/roleManager.js";
import {
  rolesOption,
  titleOption,
  descriptionOption,
  colorOption,
} from "../../utils/discord/slashCommandOptions.js";
import { getLogger } from "../../utils/logger.js";
import {
  roleUpdatedEmbed,
  permissionErrorEmbed,
  validationErrorEmbed,
  errorEmbed,
} from "../../utils/discord/responseMessages.js";

export const data = new SlashCommandBuilder()
  .setName("update-roles")
  .setDescription("Update an existing role-reaction message")
  .addStringOption(option =>
    option
      .setName("message_id")
      .setDescription("The ID of the message to update")
      .setRequired(true),
  )
  .addStringOption(titleOption())
  .addStringOption(descriptionOption())
  .addStringOption(rolesOption(false))
  .addStringOption(colorOption())
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

export async function execute(interaction) {
  const logger = getLogger();

  await interaction.deferReply({ flags: 64 });
  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.editReply(
        permissionErrorEmbed({ requiredPermissions: ["Administrator"] }),
      );
    }
    const messageId = interaction.options.getString("message_id");
    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");
    const rolesString = interaction.options.getString("roles");
    const colorHex = interaction.options.getString("color");
    const existingMapping = await getRoleMapping(messageId);
    if (!existingMapping) {
      return interaction.editReply(
        errorEmbed({
          title: "Message Not Found",
          description: "No role-reaction message found with that ID.",
          solution: "Use `/list-roles` to find the correct message ID.",
        }),
      );
    }
    const updates = {};
    if (title) updates.title = title;
    if (description) updates.description = description;

    let roleMapping = existingMapping.roles;
    if (rolesString) {
      const roleProcessingResult = await processRoles(interaction, rolesString);
      if (!roleProcessingResult.success) {
        return interaction.editReply(
          validationErrorEmbed({ errors: roleProcessingResult.errors }),
        );
      }
      roleMapping = roleProcessingResult.roleMapping;
      updates.roles = roleMapping;
    }

    if (colorHex) {
      const hex = colorHex.startsWith("#") ? colorHex : `#${colorHex}`;
      if (!/^#[0-9A-F]{6}$/i.test(hex)) {
        return interaction.editReply(
          validationErrorEmbed({
            errors: ["Invalid color format."],
            helpText:
              "Please provide a valid hex color code (e.g., #0099ff or 0099ff).",
          }),
        );
      }
      updates.color = hex;
    }
    // Merge updates into existing mapping
    const updatedMapping = { ...existingMapping, ...updates };

    // Update the original message if possible
    const channel = await interaction.guild.channels.fetch(
      existingMapping.channelId,
    );
    const message = await channel.messages.fetch(messageId);
    // Build embed
    const { EmbedBuilder } = await import("discord.js");
    const embed = new EmbedBuilder()
      .setTitle(updatedMapping.title || "Role Selection")
      .setDescription(updatedMapping.description || "React to get a role!")
      .setColor(updatedMapping.color || "#0099ff")
      .setTimestamp()
      .setFooter({
        text: "Role Reactor • Self-Assignable Roles",
        iconURL: interaction.client.user.displayAvatarURL(),
      });
    // Prepare role list
    const rolesToShow = Object.values(roleMapping || {});
    const roleList = rolesToShow
      .map(pair => {
        const limitText = pair.limit ? ` (${pair.limit} users max)` : "";
        return `${pair.emoji} <@&${pair.roleId}>${limitText}`;
      })
      .join("\n");

    embed.addFields({
      name: "🎭 Available Roles",
      value: roleList || "No roles available",
      inline: false,
    });
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
