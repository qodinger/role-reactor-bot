import { EmbedBuilder } from "discord.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../../config/theme.js";
import { getTimeframeDisplay } from "./utils.js";

export function createLeaderboardEmbed(
  leaderboard,
  leaderboardEntries,
  timeframe,
  user,
  guild,
) {
  return new EmbedBuilder()
    .setColor(THEME.PRIMARY)
    .setTitle(
      `${EMOJIS.UI.TROPHY} Experience Leaderboard - ${getTimeframeDisplay(timeframe)}`,
    )
    .setDescription(
      `**Top ${leaderboard.length} Most Active Members**\n\n${leaderboardEntries.join("\n")}`,
    )
    .setFooter(
      UI_COMPONENTS.createFooter(
        `Requested by ${user.username} • ${guild.name}`,
        user.displayAvatarURL(),
      ),
    )
    .setTimestamp();
}

export function createEmptyLeaderboardEmbed(user) {
  return new EmbedBuilder()
    .setColor(THEME.INFO)
    .setTitle(`${EMOJIS.UI.TROPHY} Experience Leaderboard`)
    .setDescription(
      `${EMOJIS.UI.INFO} No experience data found yet.\n\nStart chatting to earn XP and appear on the leaderboard!`,
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
    .setDescription("Sorry, I couldn't load the leaderboard right now.");
}
