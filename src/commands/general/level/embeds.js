import { EmbedBuilder } from "discord.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../../config/theme.js";

export function createLevelEmbed(
  targetUser,
  userData,
  progress,
  progressBar,
  rank,
  rankEmoji,
  rankColor,
  serverRank,
  guild,
) {
  return new EmbedBuilder()
    .setColor(rankColor)
    .setTitle(`${rankEmoji} ${targetUser.username}'s Level Profile`)
    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      {
        name: `${EMOJIS.UI.USERS} User`,
        value: `${targetUser.tag}`,
        inline: true,
      },
      {
        name: `${rankEmoji} Rank`,
        value: `**${rank}**`,
        inline: true,
      },
      {
        name: `${EMOJIS.FEATURES.ROLES} Level`,
        value: `**${userData.level}**`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.PROGRESS} Total XP`,
        value: `**${userData.totalXP.toLocaleString()}**`,
        inline: true,
      },
      {
        name: `${EMOJIS.TIME.CLOCK} Progress`,
        value: `**${progress.xpInCurrentLevel}/${progress.xpNeededForNextLevel}**`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.STAR} Next Level`,
        value: `**Level ${userData.level + 1}**`,
        inline: true,
      },
      {
        name: `${EMOJIS.UI.PROGRESS} Progress Bar`,
        value: `\`${progressBar}\` **${Math.round(progress.progress)}%**`,
        inline: false,
      },
    )
    .addFields({
      name: `${EMOJIS.UI.INFO} Activity Statistics`,
      value: [
        `${EMOJIS.UI.ANSWER} **Messages Sent:** ${userData.messagesSent || 0}`,
        `${EMOJIS.ACTIONS.QUICK} **Commands Used:** ${userData.commandsUsed || 0}`,
        `${EMOJIS.FEATURES.ROLES} **Roles Earned:** ${userData.rolesEarned || 0}`,
        `${EMOJIS.UI.PROGRESS} **Server Rank:** ${serverRank}`,
      ].join("\n"),
      inline: false,
    })
    .addFields({
      name: `${EMOJIS.UI.INFO} XP Breakdown`,
      value: [
        `${EMOJIS.UI.ANSWER} **Message XP:** 15-25 XP per message (60s cooldown)`,
        `${EMOJIS.ACTIONS.QUICK} **Command XP:** 3-15 XP per command (30s cooldown)`,
        `${EMOJIS.FEATURES.ROLES} **Role XP:** 50 XP per role assignment`,
      ].join("\n"),
      inline: false,
    })
    .setFooter(
      UI_COMPONENTS.createFooter(
        `Last updated: ${userData.lastUpdated ? new Date(userData.lastUpdated).toLocaleDateString() : "Never"} • ${guild.name}`,
        targetUser.displayAvatarURL(),
      ),
    )
    .setTimestamp();
}

export function createErrorEmbed() {
  return new EmbedBuilder()
    .setColor(THEME.ERROR)
    .setTitle(`${EMOJIS.STATUS.ERROR} Error`)
    .setDescription("Sorry, I couldn't load the level information right now.");
}
