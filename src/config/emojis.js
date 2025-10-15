/**
 * Custom emojis configuration for different environments
 * Manages Discord emoji IDs and formatting for development and production
 */
class EmojiConfig {
  constructor() {
    this.environment = process.env.NODE_ENV || "development";
  }

  /**
   * Get custom emojis configuration based on environment
   * @returns {Object} Custom emojis for current environment
   */
  get customEmojis() {
    // Different emoji IDs for different environments
    const emojiConfigs = {
      development: {
        core: "1427264796276817950",
        coreBasicBadge: "1427982373244637244",
        corePremiumBadge: "1427982777466359859",
        coreEliteBadge: "1427983161513607288",
        // Add more emojis here as needed
      },
      production: {
        core: "1427267639457222737",
        coreBasicBadge: "1427984193756987452",
        corePremiumBadge: "1427984335377793136",
        coreEliteBadge: "1427984418420555906",
        // Add more emojis here as needed
      },
    };

    const emojis = emojiConfigs[this.environment] || emojiConfigs.development;

    // Convert to Discord emoji format
    const formattedEmojis = {};
    for (const [name, id] of Object.entries(emojis)) {
      // Convert camelCase to snake_case for Discord emoji format
      const emojiName = name.replace(/([A-Z])/g, "_$1").toLowerCase();
      formattedEmojis[name] = `<:${emojiName}:${id}>`;
    }

    return formattedEmojis;
  }

  /**
   * Get the appropriate badge emoji for a core tier
   *
   * @param {string} tier - The core tier name (e.g., "Core Basic", "Core Premium", "Core Elite")
   * @returns {string} The badge emoji for the tier, or fallback emoji if not found
   *
   * @example
   * // Usage in embeds or messages
   * const badge = emojiConfig.getTierBadge("Core Premium");
   * // Returns: <:core_premium_badge:1427984335377793136>
   *
   * // Usage in embed fields
   * embed.addFields({
   *   name: "Tier",
   *   value: `${emojiConfig.getTierBadge(userData.coreTier)} ${userData.coreTier}`
   * });
   */
  getTierBadge(tier) {
    const badges = {
      "Core Basic": this.customEmojis.coreBasicBadge,
      "Core Premium": this.customEmojis.corePremiumBadge,
      "Core Elite": this.customEmojis.coreEliteBadge,
    };

    return badges[tier] || "⭐";
  }

  /**
   * Get all emojis as a single object
   * @returns {Object} Complete emoji configuration object
   */
  getAll() {
    return {
      customEmojis: this.customEmojis,
    };
  }
}

// Export singleton instance
export const emojiConfig = new EmojiConfig();
export default emojiConfig;
