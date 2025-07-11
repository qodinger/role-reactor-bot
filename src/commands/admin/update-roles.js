import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../utils/permissions.js";
import { getRoleMapping, setRoleMapping } from "../../utils/roleManager.js";
import {
  rolesOption,
  titleOption,
  descriptionOption,
  colorOption,
} from "../../utils/roleMessageOptions.js";

export default {
  data: new SlashCommandBuilder()
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
    const newTitle = interaction.options.getString("title");
    const newDescription = interaction.options.getString("description");
    const rolesInput = interaction.options.getString("roles");
    const colorHex = interaction.options.getString("color");

    // Parse mappings if provided
    let mapping = undefined;
    if (rolesInput) {
      mapping = {};
      for (const pair of rolesInput.split(/,|\n/)) {
        const [emoji, ...roleParts] = pair.trim().split(":");
        const role = roleParts.join(":").trim();
        if (emoji && role) mapping[emoji.trim()] = role;
      }
      if (Object.keys(mapping).length === 0) {
        return interaction.reply({
          content: "❌ No valid emoji:role pairs found.",
          ephemeral: true,
        });
      }
    }

    try {
      // Check if the message exists and has role mappings
      const roleMapping = await getRoleMapping(messageId);
      if (!roleMapping) {
        return interaction.reply({
          content: "❌ No role-reaction message found with that ID",
          ephemeral: true,
        });
      }

      // Try to edit the message in all channels
      let found = false;
      for (const [, channel] of interaction.guild.channels.cache) {
        if (!channel.isTextBased?.()) continue;
        try {
          const message = await channel.messages.fetch(messageId);
          // Update the embed if present
          if (message.embeds.length > 0) {
            const embed = message.embeds[0];
            const newEmbed = {
              ...embed.data,
              title: newTitle || embed.title,
              description: newDescription || embed.description,
              color: colorHex
                ? parseInt(colorHex.replace(/^#/, ""), 16)
                : embed.color,
              fields: mapping
                ? Object.entries(mapping).map(([emoji, role]) => ({
                    name: emoji,
                    value: role,
                    inline: true,
                  }))
                : embed.fields,
            };
            await message.edit({ embeds: [newEmbed] });
          }
          if (mapping) {
            // If the old mapping is an object with guildId, update its roles property
            let newMapping;
            if (
              roleMapping &&
              typeof roleMapping === "object" &&
              roleMapping.guildId &&
              roleMapping.roles
            ) {
              newMapping = { ...roleMapping, roles: mapping };
            } else {
              // Backward compatibility: add guildId and wrap mapping
              newMapping = { guildId: interaction.guild.id, roles: mapping };
            }
            await setRoleMapping(messageId, newMapping);
          }
          found = true;
          break;
        } catch {
          // Not found in this channel, continue
        }
      }
      if (!found) {
        return interaction.reply({
          content: "❌ Message not found in any channel.",
          ephemeral: true,
        });
      }
      await interaction.reply({
        content: "✅ Role-reaction message updated successfully!",
        ephemeral: true,
      });
    } catch (err) {
      console.error("Error editing role-reaction message:", err);
      await interaction.reply({
        content: "❌ An error occurred while editing the role-reaction message",
        ephemeral: true,
      });
    }
  },
};
