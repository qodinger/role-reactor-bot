import { EmbedBuilder } from "discord.js";
import { THEME_COLOR, THEME } from "../../../config/theme.js";

// Setup Roles embed
export function createSetupRolesEmbed(
  title,
  description,
  color,
  validRoles,
  client,
) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Click reactions to get roles!",
      iconURL: client.user.displayAvatarURL(),
    });

  const roleList = validRoles
    .map(role => {
      const limitText = role.limit ? ` (${role.limit} users max)` : "";
      return `${role.emoji} <@&${role.roleId}>${limitText}`;
    })
    .join("\n");

  embed.addFields({
    name: "🎭 Available Roles",
    value: roleList,
    inline: false,
  });

  embed.addFields({
    name: "💡 How to Use",
    value:
      "Members can click the reactions below to get or remove roles instantly!",
    inline: false,
  });

  return embed;
}

// List Roles embed
export function createListRolesEmbed(guildMappings, client) {
  const embed = new EmbedBuilder()
    .setTitle("🎭 Role-Reaction Messages")
    .setDescription(
      `Found **${guildMappings.length}** role-reaction message${guildMappings.length !== 1 ? "s" : ""} in this server.`,
    )
    .setColor(THEME_COLOR)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Click reactions to get roles!",
      iconURL: client.user.displayAvatarURL(),
    });

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

  embed.addFields({ name: "📋 Messages", value: roleList, inline: false });

  return embed;
}

// Update Roles embed
export function createUpdatedRolesEmbed(updatedMapping, roleMapping, client) {
  const embed = new EmbedBuilder()
    .setTitle(updatedMapping.title || "Role Selection")
    .setDescription(updatedMapping.description || "React to get a role!")
    .setColor(updatedMapping.color || THEME?.INFO || THEME_COLOR)
    .setTimestamp()
    .setFooter({
      text: "Role Reactor • Self-Assignable Roles",
      iconURL: client.user.displayAvatarURL(),
    });

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

  return embed;
}
