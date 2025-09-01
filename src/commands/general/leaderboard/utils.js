/**
 * Utility functions for the leaderboard command
 */

/**
 * Get timeframe display name
 * @param {string} timeframe - The timeframe value
 * @returns {string} Human-readable timeframe name
 */
export function getTimeframeDisplay(timeframe) {
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

/**
 * Format leaderboard entries with medals and XP
 * @param {Array} leaderboard - Array of leaderboard entries
 * @returns {Array} Formatted leaderboard entries
 */
export function formatLeaderboardEntries(leaderboard) {
  return leaderboard.map((user, index) => {
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
}

/**
 * Validate timeframe parameter
 * @param {string} timeframe - The timeframe to validate
 * @returns {boolean} True if valid timeframe
 */
export function isValidTimeframe(timeframe) {
  const validTimeframes = ["all", "daily", "weekly", "monthly"];
  return validTimeframes.includes(timeframe);
}
