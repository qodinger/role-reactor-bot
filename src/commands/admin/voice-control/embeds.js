import { EmbedBuilder } from "discord.js";
import { THEME } from "../../../config/theme.js";

/**
 * Create embed showing list of voice control roles
 * @param {import('discord.js').Guild} guild
 * @param {Object} settings - Voice control settings
 * @returns {import('discord.js').EmbedBuilder}
 */
export function createVoiceControlListEmbed(guild, settings) {
  const embed = new EmbedBuilder()
    .setTitle("Voice Control Roles")
    .setColor(THEME.ADMIN)
    .setTimestamp();

  const disconnectRoles = settings.disconnectRoleIds?.filter(Boolean) || [];
  const muteRoles = settings.muteRoleIds?.filter(Boolean) || [];
  const deafenRoles = settings.deafenRoleIds?.filter(Boolean) || [];
  const moveRoles = settings.moveRoleMappings
    ? Object.keys(settings.moveRoleMappings).filter(Boolean)
    : [];

  if (
    disconnectRoles.length === 0 &&
    muteRoles.length === 0 &&
    deafenRoles.length === 0 &&
    moveRoles.length === 0
  ) {
    embed.setDescription(
      "No roles are configured for voice control.\n\nUse `/voice-control disconnect add`, `/voice-control mute add`, `/voice-control deafen add`, or `/voice-control move add` to add roles.",
    );
    return embed;
  }

  let description = "";

  if (disconnectRoles.length > 0) {
    const validRoles = [];
    const invalidRoles = [];

    disconnectRoles.forEach(roleId => {
      const role = guild.roles.cache.get(roleId);
      if (role) {
        validRoles.push(role.toString());
      } else {
        invalidRoles.push(`Unknown Role (${roleId})`);
      }
    });

    let disconnectMentions = validRoles.join("\n");
    if (invalidRoles.length > 0) {
      disconnectMentions = `${disconnectMentions}\n${invalidRoles.join("\n")} *(deleted - consider removing)*`;
    }

    description += `**🔌 Disconnect Roles** (${disconnectRoles.length})\n${disconnectMentions}\n\n`;
  } else {
    description += "**🔌 Disconnect Roles**\n*None configured*\n\n";
  }

  if (muteRoles.length > 0) {
    const validRoles = [];
    const invalidRoles = [];

    muteRoles.forEach(roleId => {
      const role = guild.roles.cache.get(roleId);
      if (role) {
        validRoles.push(role.toString());
      } else {
        invalidRoles.push(`Unknown Role (${roleId})`);
      }
    });

    let muteMentions = validRoles.join("\n");
    if (invalidRoles.length > 0) {
      muteMentions = `${muteMentions}\n${invalidRoles.join("\n")} *(deleted - consider removing)*`;
    }

    description += `**🔇 Mute Roles** (${muteRoles.length})\n${muteMentions}\n\n`;
  } else {
    description += "**🔇 Mute Roles**\n*None configured*\n\n";
  }

  if (deafenRoles.length > 0) {
    const validRoles = [];
    const invalidRoles = [];

    deafenRoles.forEach(roleId => {
      const role = guild.roles.cache.get(roleId);
      if (role) {
        validRoles.push(role.toString());
      } else {
        invalidRoles.push(`Unknown Role (${roleId})`);
      }
    });

    let deafenMentions = validRoles.join("\n");
    if (invalidRoles.length > 0) {
      deafenMentions = `${deafenMentions}\n${invalidRoles.join("\n")} *(deleted - consider removing)*`;
    }

    description += `**🔊 Deafen Roles** (${deafenRoles.length})\n${deafenMentions}\n\n`;
  } else {
    description += "**🔊 Deafen Roles**\n*None configured*\n\n";
  }

  if (moveRoles.length > 0) {
    const moveMentions = moveRoles
      .map(roleId => {
        const role = guild.roles.cache.get(roleId);
        const channelId = settings.moveRoleMappings[roleId];
        const channel = guild.channels.cache.get(channelId);
        const roleMention = role ? role.toString() : `Unknown Role (${roleId})`;
        const channelMention = channel
          ? channel.toString()
          : `Unknown Channel (${channelId})`;

        let mention = `${roleMention} → ${channelMention}`;
        if (!role || !channel) {
          mention += " *(deleted - consider removing)*";
        }

        return mention;
      })
      .join("\n");

    description += `**🚚 Move Roles** (${moveRoles.length})\n${moveMentions}\n\n`;
  } else {
    description += "**🚚 Move Roles**\n*None configured*\n\n";
  }

  embed.setDescription(description);

  embed.addFields({
    name: "How It Works",
    value:
      "When a user gets any of these roles:\n• **Disconnect roles**: Users will be automatically disconnected from voice channels\n• **Mute roles**: Users will be automatically muted in voice channels\n• **Deafen roles**: Users will be automatically deafened in voice channels\n• **Move roles**: Users will be automatically moved to the specified voice channel",
    inline: false,
  });

  return embed;
}
