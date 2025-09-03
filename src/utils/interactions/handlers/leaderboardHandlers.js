import { getLogger } from "../../logger.js";

/**
 * Leaderboard button interaction handlers
 * Handles all leaderboard-related button interactions
 */

/**
 * Handle leaderboard button interactions
 * @param {import('discord.js').ButtonInteraction} interaction - The button interaction
 */
export const handleLeaderboardButton = async interaction => {
  const logger = getLogger();

  try {
    // Parse the button customId: leaderboard_timeframe_userId
    const parts = interaction.customId.split("_");
    if (parts.length !== 3) {
      logger.error(
        `Invalid leaderboard button format: ${interaction.customId}`,
      );
      return;
    }

    const timeframe = parts[1];
    const userId = parts[2];

    // Check if the button was clicked by the same user
    if (interaction.user.id !== userId) {
      await interaction.reply({
        content: "❌ You can only use your own leaderboard buttons.",
        flags: 64,
      });
      return;
    }

    // Import the leaderboard command and execute it with the new timeframe
    const { execute } = await import(
      "../../../commands/general/leaderboard/index.js"
    );

    // Temporarily set the timeframe option
    interaction.options = {
      getString: () => timeframe,
    };

    await execute(interaction, null);
  } catch (error) {
    logger.error("Error handling leaderboard button", error);

    // Only reply if the interaction hasn't been responded to yet
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: "❌ An error occurred while updating the leaderboard.",
          flags: 64,
        });
      } catch (replyError) {
        logger.error("Error sending error reply", replyError);
      }
    }
  }
};
