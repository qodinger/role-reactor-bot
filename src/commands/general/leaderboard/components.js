import { ActionRowBuilder, ButtonBuilder } from "discord.js";
import { BUTTON_STYLES } from "../../../config/theme.js";

export function createLeaderboardButtons(timeframe, userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`leaderboard_all_${userId}`)
      .setLabel("All Time")
      .setStyle(
        timeframe === "all" ? BUTTON_STYLES.PRIMARY : BUTTON_STYLES.SECONDARY,
      ),
    new ButtonBuilder()
      .setCustomId(`leaderboard_daily_${userId}`)
      .setLabel("Daily")
      .setStyle(
        timeframe === "daily" ? BUTTON_STYLES.PRIMARY : BUTTON_STYLES.SECONDARY,
      ),
    new ButtonBuilder()
      .setCustomId(`leaderboard_weekly_${userId}`)
      .setLabel("Weekly")
      .setStyle(
        timeframe === "weekly"
          ? BUTTON_STYLES.PRIMARY
          : BUTTON_STYLES.SECONDARY,
      ),
    new ButtonBuilder()
      .setCustomId(`leaderboard_monthly_${userId}`)
      .setLabel("Monthly")
      .setStyle(
        timeframe === "monthly"
          ? BUTTON_STYLES.PRIMARY
          : BUTTON_STYLES.SECONDARY,
      ),
  );
}
