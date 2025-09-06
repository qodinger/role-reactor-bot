import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export function createLeaderboardButtons(timeframe, userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`leaderboard_all_${userId}`)
      .setLabel("🏆 All Time")
      .setStyle(
        timeframe === "all" ? ButtonStyle.Primary : ButtonStyle.Secondary,
      ),
    new ButtonBuilder()
      .setCustomId(`leaderboard_daily_${userId}`)
      .setLabel("📅 Daily")
      .setStyle(
        timeframe === "daily" ? ButtonStyle.Primary : ButtonStyle.Secondary,
      ),
    new ButtonBuilder()
      .setCustomId(`leaderboard_weekly_${userId}`)
      .setLabel("📊 Weekly")
      .setStyle(
        timeframe === "weekly" ? ButtonStyle.Primary : ButtonStyle.Secondary,
      ),
    new ButtonBuilder()
      .setCustomId(`leaderboard_monthly_${userId}`)
      .setLabel("📈 Monthly")
      .setStyle(
        timeframe === "monthly" ? ButtonStyle.Primary : ButtonStyle.Secondary,
      ),
  );
}
