import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { THEME, EMOJIS } from "../../../config/theme.js";
import { getLogger } from "../../../utils/logger.js";

// Setup Roles embed
export function createSetupRolesEmbed(
  title,
  description,
  color,
  validRoles,
  client,
) {
  const embed = new EmbedBuilder()
    .setTitle(title || "Role Reactions") // Simplified title
    .setDescription(description || "Click reactions to get roles") // Simplified description
    .setColor(color || THEME.PRIMARY) // Use THEME.PRIMARY
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Role Reactions",
      iconURL: client.user.displayAvatarURL(),
    });

  const roleList = validRoles
    .map(role => {
      const limitText = role.limit ? ` (${role.limit} users max)` : "";
      return `${role.emoji} <@&${role.roleId}>${limitText}`;
    })
    .join("\n");

  embed.addFields([
    {
      name: "Available Roles", // Removed emoji
      value: roleList || "No roles available",
      inline: false,
    },
    {
      name: "Instructions", // Removed emoji
      value: "Click the reactions below to get or remove roles instantly.",
      inline: false,
    },
  ]);

  return embed;
}

// List Roles embed with pagination
export function createListRolesEmbed(
  guildMappings,
  client,
  page = 1,
  itemsPerPage = 4,
  pagination = null,
) {
  // Use pagination data if provided, otherwise calculate it
  const totalPages = pagination
    ? pagination.totalPages
    : Math.ceil(guildMappings.length / itemsPerPage);
  const totalItems = pagination ? pagination.totalItems : guildMappings.length;
  const startIndex = pagination
    ? (page - 1) * itemsPerPage
    : (page - 1) * itemsPerPage;
  const endIndex = pagination
    ? startIndex + guildMappings.length
    : startIndex + itemsPerPage;

  const embed = new EmbedBuilder()
    .setTitle("Role Reaction Messages") // Simplified title
    .setDescription(
      `Found **${totalItems}** role-reaction message${totalItems !== 1 ? "s" : ""} in this server.`,
    )
    .setColor(THEME.PRIMARY) // Use THEME.PRIMARY
    .setTimestamp()
    .setFooter({
      text: `Role Reactor • Page ${page}/${totalPages}`,
      iconURL: client.user.displayAvatarURL(),
    });

  if (guildMappings.length === 0) {
    embed.addFields([
      {
        name: "Messages", // Removed emoji
        value: "No role-reaction messages found in this server.",
        inline: false,
      },
    ]);
    return { embed, totalPages, currentPage: page };
  }

  const roleList = guildMappings
    .map(([messageId, mapping]) => {
      const rolesObj = mapping.roles || {};
      const rolesArr = Array.isArray(rolesObj)
        ? rolesObj
        : Object.values(rolesObj);
      const roleMentions = rolesArr
        .map(role =>
          role.roleId ? `<@&${role.roleId}>` : role.roleName || "Unknown",
        )
        .join(", ");
      const messageLink =
        mapping.channelId && mapping.guildId
          ? `https://discord.com/channels/${mapping.guildId}/${mapping.channelId}/${messageId}`
          : null;
      const channelInfo = messageLink
        ? `<#${mapping.channelId}> • [Jump to Message](${messageLink})`
        : mapping.channelId
          ? `<#${mapping.channelId}>`
          : "Unknown channel";
      return `**Message ID:** ${messageId}\n**Channel:** ${channelInfo}\n**Roles:** ${rolesArr.length} role(s)\n${roleMentions}`;
    })
    .join("\n\n");

  // Ensure the field value is not too long (Discord limit is 1024 characters)
  const fieldValue =
    roleList || "No role-reaction messages found in this server.";
  const truncatedValue =
    fieldValue.length > 1024
      ? `${fieldValue.substring(0, 1021)}...`
      : fieldValue;

  embed.addFields([
    {
      name: `Messages (${startIndex + 1}-${Math.min(endIndex, totalItems)} of ${totalItems})`, // Removed emoji
      value: truncatedValue,
      inline: false,
    },
  ]);

  return { embed, totalPages, currentPage: page };
}

// Create pagination buttons
export function createPaginationButtons(
  currentPage,
  totalPages,
  customIdPrefix = "rolelist",
) {
  const logger = getLogger();

  logger.debug("createPaginationButtons called", { customIdPrefix });
  const row = new ActionRowBuilder();

  // Previous button
  const prevCustomId = `${customIdPrefix}_prev_${Math.max(1, currentPage - 1)}`;
  logger.debug("Generated prevCustomId", { prevCustomId });
  const prevButton = new ButtonBuilder()
    .setCustomId(prevCustomId)
    .setLabel("Previous")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(EMOJIS.ACTIONS.BACK) // Use theme emoji
    .setDisabled(currentPage <= 1);

  // Next button
  const nextCustomId = `${customIdPrefix}_next_${Math.min(totalPages, currentPage + 1)}`;
  logger.debug("Generated nextCustomId", { nextCustomId });
  const nextButton = new ButtonBuilder()
    .setCustomId(nextCustomId)
    .setLabel("Next")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(EMOJIS.ACTIONS.FORWARD) // Use theme emoji
    .setDisabled(currentPage >= totalPages);

  // Page info button (disabled, just for display)
  const pageCustomId = `${customIdPrefix}_page_${currentPage}`;
  logger.debug("Generated pageCustomId", { pageCustomId });
  const pageButton = new ButtonBuilder()
    .setCustomId(pageCustomId)
    .setLabel(`Page ${currentPage}/${totalPages}`)
    .setStyle(ButtonStyle.Primary)
    .setDisabled(true);

  row.addComponents(prevButton, pageButton, nextButton);

  return [row];
}

// Update Roles embed
export function createUpdatedRolesEmbed(updatedMapping, roleMapping, client) {
  const embed = new EmbedBuilder()
    .setTitle(updatedMapping.title || "Role Selection") // Simplified title
    .setDescription(updatedMapping.description || "React to get a role!") // Simplified description
    .setColor(updatedMapping.color || THEME.PRIMARY) // Use THEME.PRIMARY
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Role Reactions",
      iconURL: client.user.displayAvatarURL(),
    });

  const rolesToShow = Object.values(roleMapping || {});
  const roleList = rolesToShow
    .map(pair => {
      const limitText = pair.limit ? ` (${pair.limit} users max)` : "";
      return `${pair.emoji} <@&${pair.roleId}>${limitText}`;
    })
    .join("\n");

  embed.addFields([
    {
      name: "Available Roles", // Removed emoji
      value: roleList || "No roles available",
      inline: false,
    },
  ]);

  return embed;
}
