import { EmbedBuilder } from "discord.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../../config/theme.js";

export function createServerInfoEmbed(
  guild,
  memberStats,
  channelStats,
  roleCount,
  ageInDays,
  boostInfo,
  user,
) {
  const { totalMembers, onlineMembers, botCount, humanCount } = memberStats;
  const { textChannels, voiceChannels, categories } = channelStats;
  const { boostLevel, boostCount, boostPerks } = boostInfo;

  return new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle(`${EMOJIS.UI.INFO} Server Information`)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .addFields(
      {
        name: `${EMOJIS.UI.STAR} Server Name`,
        value: guild.name,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.USERS} Members`,
        value: `${onlineMembers}/${totalMembers} online\n${humanCount} humans, ${botCount} bots`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.CHANNELS} Channels`,
        value: `${textChannels} text, ${voiceChannels} voice\n${categories} categories`,
        inline: true,
      },
      {
        name: `${EMOJIS.FEATURES.ROLES} Roles`,
        value: `${roleCount} total roles`,
        inline: true,
      },
      {
        name: `${EMOJIS.TIME.CLOCK} Created`,
        value: `<t:${Math.floor(guild.createdAt.getTime() / 1000)}:R>\n(${ageInDays} days ago)`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.OWNER} Owner`,
        value: `<@${guild.ownerId}>`,
        inline: true,
      },
      {
        name: `${EMOJIS.STATUS.SUCCESS} Server Boost`,
        value: `Level ${boostLevel} (${boostCount} boosts)\n${boostPerks[boostLevel]}`,
        inline: true,
      },
    )
    .setFooter(
      UI_COMPONENTS.createFooter(
        `Requested by ${user.username}`,
        user.displayAvatarURL(),
      ),
    )
    .setTimestamp();
}

export function createErrorEmbed() {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.STATUS.ERROR} Error`)
    .setDescription("Sorry, I couldn't load the server information right now.");
}
