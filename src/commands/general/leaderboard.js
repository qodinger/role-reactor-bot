import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { EMOJIS, THEME, UI_COMPONENTS } from "../../config/theme.js";
import { getLogger } from "../../utils/logger.js";
import { getExperienceManager } from "../../features/experience/ExperienceManager.js";

// Helper function to get timeframe display name
function getTimeframeDisplay(timeframe) {
  switch (timeframe) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    default:
      return "All Time";
  }
}

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription(
    `${EMOJIS.UI.PROGRESS} View the server experience leaderboard with time filters`,
  )
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

export async function execute(interaction, _client) {
  const logger = getLogger();

  try {
    const timeframe = interaction.options.getString("timeframe") || "all";
    const experienceManager = await getExperienceManager();
    const leaderboard = await experienceManager.getLeaderboard(
      interaction.guild.id,
      10,
    );

    if (leaderboard.length === 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(THEME.INFO)
            .setTitle(`${EMOJIS.UI.PROGRESS} Experience Leaderboard`)
            .setDescription(
              `${EMOJIS.UI.INFO} No experience data found yet.\n\nStart chatting to earn XP and appear on the leaderboard!`,
            )
            .setFooter(
              UI_COMPONENTS.createFooter(
                `Requested by ${interaction.user.username}`,
                interaction.user.displayAvatarURL(),
              ),
            )
            .setTimestamp(),
        ],
      });
    }

    // Create clean leaderboard entries
    const leaderboardEntries = leaderboard.map((user, index) => {
      const medal =
        index === 0
          ? "🥇"
          : index === 1
            ? "🥈"
            : index === 2
              ? "🥉"
              : `${index + 1}.`;
      return `${medal} <@${user.userId}> • **${user.totalXP.toLocaleString()} XP**`;
    });

    // Create interactive buttons
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`leaderboard_all_${interaction.user.id}`)
        .setLabel("🏆 All Time")
        .setStyle(
          timeframe === "all" ? ButtonStyle.Primary : ButtonStyle.Secondary,
        ),
      new ButtonBuilder()
        .setCustomId(`leaderboard_daily_${interaction.user.id}`)
        .setLabel("📅 Daily")
        .setStyle(
          timeframe === "daily" ? ButtonStyle.Primary : ButtonStyle.Secondary,
        ),
      new ButtonBuilder()
        .setCustomId(`leaderboard_weekly_${interaction.user.id}`)
        .setLabel("📊 Weekly")
        .setStyle(
          timeframe === "weekly" ? ButtonStyle.Primary : ButtonStyle.Secondary,
        ),
      new ButtonBuilder()
        .setCustomId(`leaderboard_monthly_${interaction.user.id}`)
        .setLabel("📈 Monthly")
        .setStyle(
          timeframe === "monthly" ? ButtonStyle.Primary : ButtonStyle.Secondary,
        ),
    );

    const embed = new EmbedBuilder()
      .setColor(THEME.PRIMARY)
      .setTitle(
        `${EMOJIS.UI.PROGRESS} 🏆 Experience Leaderboard - ${getTimeframeDisplay(timeframe)}`,
      )
      .setDescription(
        `**Top ${leaderboard.length} Most Active Members**\n\n${leaderboardEntries.join("\n")}`,
      )
      .setFooter(
        UI_COMPONENTS.createFooter(
          `Requested by ${interaction.user.username} • ${interaction.guild.name}`,
          interaction.user.displayAvatarURL(),
        ),
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], components: [buttons] });
    logger.logCommand("leaderboard", interaction.user.id, Date.now(), true);
  } catch (error) {
    logger.error("Error in leaderboard command", error);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(THEME.ERROR)
          .setTitle(`${EMOJIS.STATUS.ERROR} Error`)
          .setDescription("Sorry, I couldn't load the leaderboard right now."),
      ],
    });
  }
}
