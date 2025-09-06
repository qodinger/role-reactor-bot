import { SlashCommandBuilder } from "discord.js";
import { execute } from "./handlers.js";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription(`View the server experience leaderboard with time filters`)
  .addStringOption(option =>
    option
      .setName("timeframe")
      .setDescription("Time period for the leaderboard")
      .setRequired(false)
      .addChoices(
        { name: "🏆 All Time", value: "all" },
        { name: "📅 Daily", value: "daily" },
        { name: "📊 Weekly", value: "weekly" },
        { name: "📈 Monthly", value: "monthly" },
      ),
  );

export { execute };
