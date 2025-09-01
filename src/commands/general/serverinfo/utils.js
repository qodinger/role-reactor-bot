/**
 * Utility functions for the serverinfo command
 */

/**
 * Get server member statistics
 * @param {Object} guild - Discord guild object
 * @returns {Object} Member statistics
 */
export function getServerStats(guild) {
  const totalMembers = guild.memberCount;
  const onlineMembers = guild.members.cache.filter(
    m => m.presence?.status !== "offline",
  ).size;
  const botCount = guild.members.cache.filter(m => m.user.bot).size;
  const humanCount = totalMembers - botCount;

  return { totalMembers, onlineMembers, botCount, humanCount };
}

/**
 * Get channel counts by type
 * @param {Object} guild - Discord guild object
 * @returns {Object} Channel counts
 */
export function getChannelCounts(guild) {
  const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
  const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
  const categories = guild.channels.cache.filter(c => c.type === 4).size;

  return { textChannels, voiceChannels, categories };
}

/**
 * Get server boost information
 * @param {Object} guild - Discord guild object
 * @returns {Object} Boost information
 */
export function getBoostInfo(guild) {
  const boostLevel = guild.premiumTier;
  const boostCount = guild.premiumSubscriptionCount;
  const boostPerks = {
    0: "No boosts",
    1: "Level 1 perks",
    2: "Level 2 perks + 15 extra emoji slots",
    3: "Level 3 perks + 30 extra emoji slots + animated server icon",
  };

  return { boostLevel, boostCount, boostPerks };
}

/**
 * Calculate server age in days
 * @param {Date} createdAt - Server creation date
 * @returns {number} Age in days
 */
export function calculateServerAge(createdAt) {
  return Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
}
