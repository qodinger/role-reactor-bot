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
export async function handleLeaderboard(interaction, client, options = {}) {
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

    // Get options (simple limit for all users)
    const requestedLimit = interaction.options.getInteger("limit") || 10;
    const type = interaction.options.getString("type") || "xp";

    // Simple max limit for all users (Discord embed field value limit is 1024 chars)
    // ~20 entries fit comfortably in one field
    const MAX_LIMIT = 20;

    // Enforce max limit
    const limit = Math.min(requestedLimit, MAX_LIMIT);

    // If user requested more than the limit, show a message
    if (requestedLimit > MAX_LIMIT) {
      logger.debug(
        `User ${interaction.user.tag} requested ${requestedLimit} but limit is ${MAX_LIMIT}`,
      );
    }

    // Allow dependency injection for testing
    const getExperienceManager =
      options.getExperienceManager ||
      (await import("../../../features/experience/ExperienceManager.js"))
        .getExperienceManager;
    const experienceManager = await getExperienceManager();

    // Get leaderboard data
    let leaderboardData;
    if (type === "xp") {
      // Fetch one extra in case the bot is included, will filter below
      leaderboardData = await experienceManager.getLeaderboard(
        interaction.guild.id,
        limit + 1,
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
        client.user.id,
      );
    }

    // Exclude the bot from the leaderboard
    if (leaderboardData && leaderboardData.length > 0) {
      leaderboardData = leaderboardData
        .filter(user => user.userId !== client.user.id)
        .slice(0, limit);
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

    // Resolve display names
    try {
      const userIds = leaderboardData.map(u => u.userId);
      const members = await interaction.guild.members.fetch({ user: userIds });
      leaderboardData = leaderboardData.map(entry => {
        const member = members.get(entry.userId);
        return {
          ...entry,
          displayName:
            member?.displayName ||
            member?.user?.username ||
            `User ${entry.userId}`,
        };
      });
    } catch (e) {
      logger.warn("Failed to fetch leaderboard members", e);
      // Fallback to cache or IDs
      leaderboardData = leaderboardData.map(entry => ({
        ...entry,
        displayName:
          interaction.guild.members.cache.get(entry.userId)?.displayName ||
          `User ${entry.userId}`,
      }));
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
  botId = null,
) {
  if (!getStorageManager) {
    const { getStorageManager: defaultGetStorageManager } = await import(
      "../../../utils/storage/storageManager.js"
    );
    getStorageManager = defaultGetStorageManager;
  }
  const storageManager = await getStorageManager();
  const guildUsers = (
    await storageManager.getUserExperienceLeaderboard(guildId, 1000)
  ).filter(user => user.userId !== botId);

  // Sort based on type
  let sortedUsers;
  switch (type) {
    case "level":
      sortedUsers = guildUsers.sort((a, b) => {
        // Calculate level from totalXP using the correct formula
        const getLevel = totalXP => {
          let level = 1;
          while (Math.floor(100 * Math.pow(level, 1.5)) <= (totalXP || 0)) {
            level++;
          }
          return level - 1;
        };

        const levelA = getLevel(a.totalXP || a.xp || 0);
        const levelB = getLevel(b.totalXP || b.xp || 0);

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
        (a, b) => (b.totalXP || b.xp || 0) - (a.totalXP || a.xp || 0),
      );
  }

  return sortedUsers.slice(0, limit);
}
