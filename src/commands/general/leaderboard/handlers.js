import { getLogger } from "../../../utils/logger.js";
import { getDatabaseManager as defaultGetDatabaseManager } from "../../../utils/storage/databaseManager.js";
import { errorEmbed } from "../../../utils/discord/responseMessages.js";
import { createLeaderboardEmbed } from "./embeds.js";

/**
 * Handle the leaderboard display
 * @param {import('discord.js').CommandInteraction} interaction
 * @param {import('discord.js').Client} client
 * @param {Object} options - Optional dependencies for testing
 * @param {Function} options.getDatabaseManager - Optional database manager getter
 * @param {Function} options.getExperienceManager - Optional experience manager getter
 * @param {Function} options.getStorageManager - Optional storage manager getter
 */
export async function handleLeaderboard(interaction, _client, options = {}) {
  const logger = getLogger();
  const startTime = Date.now();

  try {
    // Allow dependency injection for testing
    const getDatabaseManager =
      options.getDatabaseManager || defaultGetDatabaseManager;
    const dbManager = await getDatabaseManager();

    if (!dbManager.guildSettings) {
      return interaction.editReply(
        errorEmbed({
          title: "Database Error",
          description: "Guild settings repository is not available.",
          solution:
            "Please restart the bot or contact support if the issue persists.",
        }),
      );
    }

    // Check if XP system is enabled
    const guildSettings = await dbManager.guildSettings.getByGuild(
      interaction.guild.id,
    );
    if (!guildSettings.experienceSystem.enabled) {
      return interaction.editReply(
        errorEmbed({
          title: "XP System Disabled",
          description: "The XP system is not enabled for this server.",
          solution:
            "Ask an administrator to enable the XP system using `/xp setup`.",
        }),
      );
    }

    // Get options
    const limit = interaction.options.getInteger("limit") || 10;
    const type = interaction.options.getString("type") || "xp";

    // Allow dependency injection for testing
    const getExperienceManager =
      options.getExperienceManager ||
      (await import("../../../features/experience/ExperienceManager.js"))
        .getExperienceManager;
    const experienceManager = await getExperienceManager();

    // Get leaderboard data
    let leaderboardData;
    if (type === "xp") {
      leaderboardData = await experienceManager.getLeaderboard(
        interaction.guild.id,
        limit,
      );
    } else {
      // For other types, we'll need to implement custom sorting
      // Allow dependency injection for testing
      const getStorageManager =
        options.getStorageManager ||
        (await import("../../../utils/storage/storageManager.js"))
          .getStorageManager;
      leaderboardData = await getCustomLeaderboard(
        interaction.guild.id,
        type,
        limit,
        getStorageManager,
      );
    }

    if (!leaderboardData || leaderboardData.length === 0) {
      return interaction.editReply(
        errorEmbed({
          title: "No Data",
          description: "No XP data found for this server.",
          solution: "Start chatting to earn XP and appear on the leaderboard!",
        }),
      );
    }

    // Create leaderboard embed
    const embed = createLeaderboardEmbed(
      interaction,
      leaderboardData,
      type,
      limit,
    );

    await interaction.editReply({
      embeds: [embed],
    });

    const duration = Date.now() - startTime;
    logger.info(
      `Leaderboard displayed for guild ${interaction.guild.name} by user ${interaction.user.tag} in ${duration}ms`,
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Error displaying leaderboard after ${duration}ms`, error);
    await interaction.editReply(
      errorEmbed({
        title: "Error",
        description: "Failed to display leaderboard.",
        solution: "Please try again or contact support if the issue persists.",
      }),
    );
  }
}

/**
 * Get custom leaderboard data based on type
 * @param {string} guildId - Discord guild ID
 * @param {string} type - Leaderboard type
 * @param {number} limit - Number of users to return
 * @param {Function} getStorageManager - Optional storage manager getter for testing
 * @returns {Array} Sorted leaderboard data
 */
async function getCustomLeaderboard(
  guildId,
  type,
  limit,
  getStorageManager = null,
) {
  if (!getStorageManager) {
    const { getStorageManager: defaultGetStorageManager } = await import(
      "../../../utils/storage/storageManager.js"
    );
    getStorageManager = defaultGetStorageManager;
  }
  const storageManager = await getStorageManager();
  const experienceData = await storageManager.read("user_experience");

  const guildUsers = Object.entries(experienceData)
    .filter(([key]) => key.startsWith(`${guildId}_`))
    .map(([key, data]) => ({
      userId: key.split("_")[1],
      ...data,
    }));

  // Sort based on type
  let sortedUsers;
  switch (type) {
    case "level":
      sortedUsers = guildUsers.sort((a, b) => {
        // Calculate level from totalXP using the correct formula
        let levelA = 1;
        while (Math.floor(100 * Math.pow(levelA, 1.5)) <= (a.totalXP || 0)) {
          levelA++;
        }
        levelA = levelA - 1;

        let levelB = 1;
        while (Math.floor(100 * Math.pow(levelB, 1.5)) <= (b.totalXP || 0)) {
          levelB++;
        }
        levelB = levelB - 1;

        return levelB - levelA;
      });
      break;
    case "messages":
      sortedUsers = guildUsers.sort(
        (a, b) => (b.messagesSent || 0) - (a.messagesSent || 0),
      );
      break;
    case "voice":
      sortedUsers = guildUsers.sort(
        (a, b) => (b.voiceTime || 0) - (a.voiceTime || 0),
      );
      break;
    default:
      sortedUsers = guildUsers.sort(
        (a, b) => (b.totalXP || 0) - (a.totalXP || 0),
      );
  }

  return sortedUsers.slice(0, limit);
}
