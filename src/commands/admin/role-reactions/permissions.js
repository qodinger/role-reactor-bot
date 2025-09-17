import { getLogger } from "../../../utils/logger.js";
import {
  botHasRequiredPermissions,
  getMissingBotPermissions,
  formatPermissionName,
} from "../../../utils/discord/permissions.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";

/**
 * Validates guild-level permissions
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Validation result with success boolean and error response
 */
export function validateGuildPermissions(interaction) {
  const logger = getLogger();

  const guildHasPermissions = botHasRequiredPermissions(interaction.guild);
  logger.debug("Guild permissions check", {
    hasAllPermissions: guildHasPermissions,
    guildId: interaction.guild.id,
    guildName: interaction.guild.name,
  });

  if (!guildHasPermissions) {
    const missingPermissions = getMissingBotPermissions(interaction.guild);
    const permissionNames = missingPermissions
      .map(formatPermissionName)
      .join(", ");

    logger.warn("Missing guild permissions", { permissions: permissionNames });

    return {
      success: false,
      errorResponse: errorEmbed({
        title: "Missing Bot Permissions",
        description: `I need the following server-level permissions: **${permissionNames}**`,
        solution:
          "Please ask a server administrator to grant me these permissions and try again.",
        fields: [
          {
            name: "🔧 How to Fix (Server Level)",
            value:
              "1. Go to **Server Settings** → **Roles**\n2. Find my role (Role Reactor)\n3. Enable the missing permissions listed above\n4. Make sure my role is positioned above the roles you want to assign",
            inline: false,
          },
          {
            name: "📋 Required Server Permissions",
            value:
              "• **Manage Roles** - To assign/remove roles from users\n• **Manage Messages** - To manage role-reaction messages\n• **Add Reactions** - To add emoji reactions to messages\n• **Read Message History** - To read channel history\n• **View Channel** - To access channel information\n• **Send Messages** - To send role-reaction messages\n• **Embed Links** - To create rich embeds\n• **Manage Server** - To manage server settings\n• **Use External Emojis** - To use emojis from other servers",
            inline: false,
          },
        ],
      }),
    };
  }

  return { success: true };
}

/**
 * Validates channel-specific permissions
 * @param {Object} interaction - Discord interaction object
 * @param {Array} requiredPermissions - Array of required permission names
 * @returns {Object} Validation result with success boolean and error response
 */
export function validateChannelPermissions(
  interaction,
  requiredPermissions = ["SendMessages", "EmbedLinks", "AddReactions"],
) {
  const logger = getLogger();

  const channelPermissions = interaction.channel.permissionsFor(
    interaction.guild.members.me,
  );

  logger.debug("Channel permissions check", {
    hasSendMessages: channelPermissions.has("SendMessages"),
    hasEmbedLinks: channelPermissions.has("EmbedLinks"),
    hasAddReactions: channelPermissions.has("AddReactions"),
    channelId: interaction.channel.id,
    channelName: interaction.channel.name,
  });

  // Check for missing channel permissions
  const missingChannelPermissions = [];
  const permissionDisplayNames = {
    SendMessages: "Send Messages",
    EmbedLinks: "Embed Links",
    AddReactions: "Add Reactions",
  };

  for (const permission of requiredPermissions) {
    if (!channelPermissions.has(permission)) {
      missingChannelPermissions.push(
        permissionDisplayNames[permission] || permission,
      );
    }
  }

  if (missingChannelPermissions.length > 0) {
    logger.warn("Missing channel permissions", {
      permissions: missingChannelPermissions,
    });

    // Special handling for Add Reactions permission
    if (missingChannelPermissions.includes("Add Reactions")) {
      logger.warn("BLOCKING setup due to missing Add Reactions permission");
      return {
        success: false,
        errorResponse: errorEmbed({
          title: "Cannot Setup Role Reactions",
          description:
            "I don't have the **Add Reactions** permission in this channel, which is required to create role-reaction messages.",
          solution:
            "Please grant me the **Add Reactions** permission in this channel and try again.",
          fields: [
            {
              name: "🔧 How to Fix (Channel Level)",
              value:
                "1. Right-click on this channel → **Edit Channel**\n2. Go to **Permissions** tab\n3. Find my role (Role Reactor) or @everyone\n4. Enable **Add Reactions** permission\n5. Make sure no other role is denying this permission",
              inline: false,
            },
            {
              name: "📋 Why This Permission is Critical",
              value:
                "• **Add Reactions** - Required to add emoji reactions to role-reaction messages\n• Without this permission, role-reaction messages are useless\n• Users won't be able to click reactions to get/remove roles",
              inline: false,
            },
          ],
        }),
      };
    }

    return {
      success: false,
      errorResponse: errorEmbed({
        title: "Missing Channel Permissions",
        description: `I don't have permission to **${missingChannelPermissions.join("** and **")}** in this channel.`,
        solution:
          "Please grant me the missing permissions in this channel and try again.",
        fields: [
          {
            name: "🔧 How to Fix (Channel Level)",
            value:
              "1. Right-click on this channel → **Edit Channel**\n2. Go to **Permissions** tab\n3. Find my role (Role Reactor) or @everyone\n4. Enable the missing permissions listed above\n5. Make sure no other role is denying these permissions",
            inline: false,
          },
          {
            name: "📋 Missing Channel Permissions",
            value: missingChannelPermissions
              .map(
                perm => `• **${perm}** - Required for role-reaction messages`,
              )
              .join("\n"),
            inline: false,
          },
        ],
      }),
    };
  }

  return { success: true };
}

/**
 * Performs a final permission check before critical operations
 * @param {Object} interaction - Discord interaction object
 * @param {Array} requiredPermissions - Array of required permission names
 * @returns {Object} Validation result with success boolean and error response
 */
export function performFinalPermissionCheck(
  interaction,
  requiredPermissions = ["AddReactions", "SendMessages", "EmbedLinks"],
) {
  const logger = getLogger();

  const finalPermissionCheck = interaction.channel.permissionsFor(
    interaction.guild.members.me,
  );

  logger.debug("Final permission check", {
    hasAddReactions: finalPermissionCheck.has("AddReactions"),
    hasSendMessages: finalPermissionCheck.has("SendMessages"),
    hasEmbedLinks: finalPermissionCheck.has("EmbedLinks"),
  });

  for (const permission of requiredPermissions) {
    if (!finalPermissionCheck.has(permission)) {
      logger.error(
        `CRITICAL ERROR: ${permission} permission missing at critical operation time!`,
      );
      return {
        success: false,
        errorResponse: errorEmbed({
          title: "Permission Error",
          description: `${permission} permission was lost during operation.`,
          solution: `Please grant me the ${permission} permission and try again.`,
        }),
      };
    }
  }

  return { success: true };
}
