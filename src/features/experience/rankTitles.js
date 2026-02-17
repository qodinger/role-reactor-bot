/**
 * Rank Titles System
 * Maps level ranges to cosmetic titles with emojis and theme colors.
 * Used by /level and /leaderboard commands.
 *
 * This is a purely cosmetic feature — no database changes needed.
 * Titles are calculated dynamically from the user's current level.
 */

/**
 * Rank title definitions ordered by level threshold (ascending).
 * Each entry defines the minimum level required for that rank.
 */
const RANK_TIERS = [
  { minLevel: 300, title: "Legend", emoji: "🔴", color: 0xef4444 },
  { minLevel: 150, title: "Master", emoji: "🟠", color: 0xf97316 },
  { minLevel: 80, title: "Veteran", emoji: "🟡", color: 0xeab308 },
  { minLevel: 40, title: "Adept", emoji: "🟣", color: 0xa855f7 },
  { minLevel: 15, title: "Apprentice", emoji: "🔵", color: 0x3b82f6 },
  { minLevel: 1, title: "Novice", emoji: "🟢", color: 0x22c55e },
];

/**
 * Get rank info for a given level
 * @param {number} level - The user's current level
 * @returns {{ title: string, emoji: string, color: number, minLevel: number }}
 */
export function getRankTitle(level) {
  for (const tier of RANK_TIERS) {
    if (level >= tier.minLevel) {
      return tier;
    }
  }

  // Fallback for level 0 (shouldn't happen, but just in case)
  return { title: "Novice", emoji: "🟢", color: 0x22c55e, minLevel: 1 };
}

/**
 * Get a formatted rank string like "🟣 Adept"
 * @param {number} level - The user's current level
 * @returns {string}
 */
export function getFormattedRank(level) {
  const rank = getRankTitle(level);
  return `${rank.emoji} ${rank.title}`;
}

/**
 * Get all rank tiers (for help / info displays)
 * @returns {Array<{ minLevel: number, title: string, emoji: string, color: number }>}
 */
export function getAllRankTiers() {
  // Return in ascending order for display
  return [...RANK_TIERS].reverse();
}
