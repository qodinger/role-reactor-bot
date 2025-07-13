import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { hasAdminPermissions } from "../../utils/permissions.js";
import {
  getRoleMapping,
  setRoleMapping,
  parseRoleString,
} from "../../utils/roleManager.js";
import {
  rolesOption,
  titleOption,
  descriptionOption,
  colorOption,
} from "../../utils/roleMessageOptions.js";

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

// Validate that a message exists in a channel
export async function validateMessage(channel, messageId) {
  try {
    const message = await channel.messages.fetch(messageId);
    return message;
  } catch {
    return null;
  }
}

// Validate that roles exist in a guild
export function validateRoles(guild, roleIds) {
  const valid = [];
  const invalid = [];

  for (const roleId of roleIds) {
    const role = guild.roles.cache.get(roleId);
    if (role) {
      valid.push(role);
    } else {
      invalid.push(roleId);
    }
  }

  return { valid, invalid };
}

// Generate message content from roles
export function generateMessageContent(roles) {
  if (roles.length === 0) {
    return "No roles available";
  }

  if (roles.length === 1) {
    return `**${roles[0].name}**`;
  }

  const roleNames = roles.map(role => `**${role.name}**`).join("\n");
  return `**Roles:**\n${roleNames}`;
}

// Update message content with roles
export async function updateMessageContent(message, roles) {
  try {
    const content = generateMessageContent(roles);
    await message.edit(content);
    return true;
  } catch {
    return false;
  }
}

// Get role information from guild
export function getRoleInfo(guild, roleIds) {
  const roles = [];

  for (const roleId of roleIds) {
    const role = guild.roles.cache.get(roleId);
    if (role) {
      roles.push(role);
    }
  }

  return roles;
}

export async function execute(interaction) {
  await interaction.deferReply({ flags: 64 });
  try {
    if (!hasAdminPermissions(interaction.member)) {
      return interaction.editReply({
        content: "❌ You need administrator permissions to use this command!",
        flags: 64,
      });
    }
    const messageId = interaction.options.getString("message_id");
    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");
    const rolesString = interaction.options.getString("roles");
    const colorHex = interaction.options.getString("color");
    const existingMapping = await getRoleMapping(messageId);
    if (!existingMapping) {
      return interaction.editReply({
        content: "❌ No role-reaction message found with that ID.",
        flags: 64,
      });
    }
    const updates = {};
    if (title) updates.title = title;
    if (description) updates.description = description;
    if (rolesString) {
      const { roles, errors } = parseRoleString(rolesString);
      if (errors.length > 0) {
        return interaction.editReply({
          content: `❌ **Parse Errors**\n\n${errors.join("\n")}`,
          flags: 64,
        });
      }
      updates.roles = roles;
    }
    if (colorHex) {
      const hex = colorHex.startsWith("#") ? colorHex : `#${colorHex}`;
      if (!/^#[0-9A-F]{6}$/i.test(hex)) {
        return interaction.editReply({
          content:
            "❌ **Invalid Color Format**\nPlease provide a valid hex color code (e.g., #0099ff or 0099ff)",
          flags: 64,
        });
      }
      updates.color = hex;
    }
    const updatedMapping = { ...existingMapping, ...updates };
    await setRoleMapping(messageId, updatedMapping);
    await interaction.editReply({
      content: `✅ **Role-Reaction Message Updated!**\n\n**Message ID:** ${messageId}\n**Updates:** ${Object.keys(updates).join(", ")}`,
      flags: 64,
    });
  } catch (error) {
    console.error("Error updating roles:", error);
    await interaction.editReply({
      content:
        "❌ **Error**\nAn error occurred while updating the role-reaction message. Please try again.",
      flags: 64,
    });
  }
}
