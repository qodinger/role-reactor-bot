import { THEME } from "../../../config/theme.js";

/**
 * Calculate user's rank in the server
 * @param {Array} leaderboard - Array of leaderboard entries
 * @param {string} userId - User ID to find rank for
 * @returns {string} Formatted rank string
 */
export function calculateUserRank(leaderboard, userId) {
  const userRank = leaderboard.findIndex(user => user.userId === userId) + 1;
  const totalUsers = leaderboard.length;
  return userRank > 0 ? `#${userRank} of ${totalUsers}` : "Unranked";
}

/**
 * Create a visual progress bar
 * @param {number} progress - Progress percentage (0-100)
 * @returns {string} Progress bar string
 */
export function calculateProgressBar(progress) {
  const progressBarLength = 20;
  const filledBars = Math.floor((progress / 100) * progressBarLength);
  const emptyBars = progressBarLength - filledBars;
  return "█".repeat(filledBars) + "░".repeat(emptyBars);
}

/**
 * Determine user rank and color based on level
 * @param {number} level - User's current level
 * @returns {Object} Object containing rank and color
 */
export function determineUserRank(level) {
  let rank = "Newcomer";
  let rankColor = THEME.SUCCESS;

  if (level >= 50) {
    rank = "Legend";
    rankColor = THEME.WARNING; // Gold for Legend
  } else if (level >= 30) {
    rank = "Veteran";
    rankColor = THEME.WARNING; // Orange for Veteran
  } else if (level >= 20) {
    rank = "Experienced";
    rankColor = THEME.ACCENT; // Purple for Experienced
  } else if (level >= 10) {
    rank = "Regular";
    rankColor = THEME.INFO; // Blue for Regular
  } else if (level >= 5) {
    rank = "Active";
    rankColor = THEME.ERROR; // Red for Active
  }

  return { rank, rankColor };
}
