import pLimit from "p-limit";
// logger not required in this module
import {
  botHasRequiredPermissions,
  getMissingBotPermissions,
  formatPermissionName,
} from "../../../utils/discord/permissions.js";
import {
  errorEmbed,
  roleCreatedEmbed,
} from "../../../utils/discord/responseMessages.js";
import {
  processRoles,
  setRoleMapping,
  getAllRoleMappings,
  getRoleMapping,
} from "./utils.js";
import {
  createSetupRolesEmbed,
  createListRolesEmbed,
  createUpdatedRolesEmbed,
} from "./embeds.js";
import { THEME_COLOR } from "../../../config/theme.js";

export async function handleSetup(interaction, client) {
  await interaction.deferReply({ flags: 64 });

  if (!botHasRequiredPermissions(interaction.guild)) {
    const missingPermissions = getMissingBotPermissions(interaction.guild);
    const permissionNames = missingPermissions
      .map(formatPermissionName)
      .join(", ");
    return interaction.editReply(
      errorEmbed({
        title: "Missing Bot Permissions",
        description: `I need the following permissions to create role-reaction messages: **${permissionNames}**`,
        solution:
          "Please ask a server administrator to grant me these permissions and try again.",
        fields: [
          {
            name: "🔧 How to Fix",
            value:
              "1. Go to **Server Settings** → **Roles**\n2. Find my role (Role Reactor)\n3. Enable the missing permissions listed above\n4. Make sure my role is positioned above the roles you want to assign",
            inline: false,
          },
          {
            name: "📋 Required Permissions",
            value:
              "• **Manage Roles** - To assign/remove roles from users\n• **Manage Messages** - To manage role-reaction messages\n• **Add Reactions** - To add emoji reactions to messages\n• **Read Message History** - To read channel history\n• **View Channel** - To access channel information\n• **Send Messages** - To send role-reaction messages\n• **Embed Links** - To create rich embeds",
            inline: false,
          },
        ],
      }),
    );
  }

  const title = interaction.options.getString("title");
  const description = interaction.options.getString("description");
  const rolesString = interaction.options.getString("roles");
  let colorHex = interaction.options.getString("color");

  // Color
  let color = THEME_COLOR;
  if (colorHex) {
    if (!colorHex.startsWith("#")) colorHex = `#${colorHex}`;
    color = colorHex;
  }

  // Roles processing via shared util
  const roleProcessingResult = await processRoles(interaction, rolesString);
  if (!roleProcessingResult.success) {
    return interaction.editReply(
      errorEmbed({
        title: "Role Processing Error",
        description:
          roleProcessingResult.errors?.join("\n") || roleProcessingResult.error,
        solution: "Please check your role format and try again.",
      }),
    );
  }

  const { validRoles, roleMapping } = roleProcessingResult;
  const embed = createSetupRolesEmbed(
    title,
    description,
    color,
    validRoles,
    client,
  );

  const message = await interaction.channel.send({ embeds: [embed] });

  const limiter = pLimit(3);
  await Promise.all(
    validRoles.map(role =>
      limiter(async () => {
        try {
          await message.react(role.emoji);
        } catch (_err) {
          // ignore per-role reaction failure; overall flow continues
        }
      }),
    ),
  );

  await setRoleMapping(
    message.id,
    interaction.guild.id,
    interaction.channel.id,
    roleMapping,
  );

  await interaction.editReply(
    roleCreatedEmbed({
      messageUrl: message.url,
      roleCount: validRoles.length,
      channelId: interaction.channel.id,
    }),
  );
}

export async function handleList(interaction, client) {
  await interaction.deferReply({ flags: 64 });
  const allMappings = await getAllRoleMappings();
  const guildMappings = Object.entries(allMappings).filter(
    ([, m]) => m.guildId === interaction.guild.id,
  );
  if (guildMappings.length === 0) {
    return interaction.editReply(
      errorEmbed({
        title: "No Role-Reaction Messages Found",
        description:
          "There are no role-reaction messages set up in this server yet.",
        solution:
          "Use `role-reactions setup` to create your first role-reaction message!",
      }),
    );
  }
  const embed = createListRolesEmbed(guildMappings, client);
  await interaction.editReply({ embeds: [embed], flags: 64 });
}

export async function handleDelete(interaction) {
  await interaction.deferReply({ flags: 64 });
  const messageId = interaction.options.getString("message_id");
  const mapping = await getRoleMapping(messageId, interaction.guild.id);
  if (!mapping) {
    return interaction.editReply(
      errorEmbed({
        title: "Message Not Found",
        description:
          "I couldn't find a role-reaction message with that ID in this server.",
      }),
    );
  }
  let msg = null;
  const channel = interaction.guild.channels.cache.get(mapping.channelId);
  if (channel) {
    msg = await channel.messages.fetch(messageId).catch(() => null);
  }
  const { removeRoleMapping } = await import(
    "../../../utils/discord/roleMappingManager.js"
  );
  await removeRoleMapping(messageId, interaction.guild.id);
  if (msg) await msg.delete().catch(() => null);
  const { roleDeletedEmbed } = await import(
    "../../../utils/discord/responseMessages.js"
  );
  await interaction.editReply(
    roleDeletedEmbed({
      messageId,
      rolesRemoved: Object.keys(mapping.roles || {}).length,
      messageDeleted: !!msg,
    }),
  );
}

export async function handleUpdate(interaction) {
  await interaction.deferReply({ flags: 64 });
  const messageId = interaction.options.getString("message_id");
  const title = interaction.options.getString("title");
  const description = interaction.options.getString("description");
  const rolesString = interaction.options.getString("roles");
  const colorHex = interaction.options.getString("color");

  const mapping = await getRoleMapping(messageId, interaction.guild.id);
  if (!mapping) {
    return interaction.editReply(
      errorEmbed({
        title: "Message Not Found",
        description:
          "I couldn't find a role-reaction message with that ID in this server.",
      }),
    );
  }

  const updates = {};
  if (title) updates.title = title;
  if (description) updates.description = description;

  let roleMapping = mapping.roles;
  if (rolesString) {
    const result = await processRoles(rolesString, interaction.guild);
    if (!result.success) {
      return interaction.editReply(
        errorEmbed({
          title: "Role Processing Error",
          description: result.error || "Failed to process roles.",
        }),
      );
    }
    roleMapping = result.roleMapping;
    updates.roles = roleMapping;
  }

  if (colorHex) {
    const hex = colorHex.startsWith("#") ? colorHex : `#${colorHex}`;
    if (!/^#[0-9A-F]{6}$/i.test(hex)) {
      return interaction.editReply(
        errorEmbed({
          title: "Invalid Color Format",
          description: "Provide a valid 6-digit hex color.",
        }),
      );
    }
    updates.color = hex;
  }

  const updatedMapping = { ...mapping, ...updates };
  const channel = await interaction.guild.channels.fetch(mapping.channelId);
  const message = await channel.messages.fetch(messageId);
  const embed = createUpdatedRolesEmbed(
    updatedMapping,
    roleMapping,
    interaction.client,
  );
  await message.edit({ embeds: [embed] });

  const { setRoleMapping: setMap } = await import(
    "../../../utils/discord/roleMappingManager.js"
  );
  await setMap(
    messageId,
    updatedMapping.guildId,
    updatedMapping.channelId,
    roleMapping,
  );

  const { roleUpdatedEmbed } = await import(
    "../../../utils/discord/responseMessages.js"
  );
  await interaction.editReply(
    roleUpdatedEmbed({
      messageId,
      updates: Object.keys(updates).join(", "),
      changeCount: Object.keys(updates).length,
    }),
  );
}
