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
        coreBasic: "1427264796276817950",
        premiumBadge: "1427242549403324536",
        eliteBadge: "1427242061991514142",
        // Add more emojis here as needed
        // star: "dev_star_emoji_id",
        // diamond: "dev_diamond_emoji_id",
        // premium: "dev_premium_emoji_id",
      },
      production: {
        core: "1427267639457222737",
        coreBasic: "1427267639457222737",
        premiumBadge: "1427267639457222737",
        eliteBadge: "1427267639457222737",
        // Add more emojis here as needed
        // star: "prod_star_emoji_id",
        // diamond: "prod_diamond_emoji_id",
        // premium: "prod_premium_emoji_id",
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
