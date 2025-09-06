import { getLogger } from "../../../utils/logger.js";
import { getExperienceManager } from "../../../features/experience/ExperienceManager.js";
import {
  createLeaderboardEmbed,
  createEmptyLeaderboardEmbed,
  createErrorEmbed,
} from "./embeds.js";
import { createLeaderboardButtons } from "./components.js";
import { formatLeaderboardEntries } from "./utils.js";

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
      const embed = createEmptyLeaderboardEmbed(interaction.user);
      return interaction.reply({ embeds: [embed] });
    }

    // Create clean leaderboard entries
    const leaderboardEntries = formatLeaderboardEntries(leaderboard);

    // Create interactive buttons
    const buttons = createLeaderboardButtons(timeframe, interaction.user.id);

    const embed = createLeaderboardEmbed(
      leaderboard,
      leaderboardEntries,
      timeframe,
      interaction.user,
      interaction.guild,
    );

    await interaction.reply({ embeds: [embed], components: [buttons] });
    logger.logCommand("leaderboard", interaction.user.id, Date.now(), true);
  } catch (error) {
    logger.error("Error in leaderboard command", error);
    await interaction.reply({
      embeds: [createErrorEmbed()],
    });
  }
}
