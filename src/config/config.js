import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Configuration management class following Discord API best practices
 */
class Config {
  constructor() {
    this.validateRequiredEnvVars();
  }

  /**
   * Get current environment
   * @returns {string} Current environment
   */
  get environment() {
    return process.env.NODE_ENV || "development";
  }

  /**
   * Check if running in production
   * @returns {boolean} True if production
   */
  get isProduction() {
    return this.environment === "production";
  }

  /**
   * Check if running in development
   * @returns {boolean} True if development
   */
  get isDevelopment() {
    return this.environment === "development";
  }

  /**
   * Validate required environment variables
   * @throws {Error} If required environment variables are missing
   */
  validateRequiredEnvVars() {
    const requiredVars = ["DISCORD_TOKEN", "CLIENT_ID"];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(", ")}`,
      );
    }
  }

  /**
   * Get Discord configuration
   * @returns {Object} Discord configuration object
   */
  get discord() {
    return {
      token: process.env.DISCORD_TOKEN,
      clientId: process.env.CLIENT_ID,
      guildId: process.env.GUILD_ID,
      botOwners: this.parseBotOwners(),
    };
  }

  /**
   * Get database configuration
   * @returns {Object} Database configuration object
   */
  get database() {
    return {
      uri: process.env.MONGODB_URI || "mongodb://localhost:27017",
      name: process.env.MONGODB_DB || "role-reactor-bot",
      options: {
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        retryReads: true,
        w: "majority",
      },
    };
  }

  /**
   * Get logging configuration
   * @returns {Object} Logging configuration object
   */
  get logging() {
    return {
      level: process.env.LOG_LEVEL || "INFO",
      file: process.env.LOG_FILE,
      console: process.env.LOG_CONSOLE !== "false",
    };
  }

  /**
   * Get client intents configuration
   * @returns {Object} Client intents configuration
   */
  get intents() {
    return {
      guilds: true,
      guildMembers: true,
      guildMessages: true,
      guildMessageReactions: true,
      messageContent: true,
    };
  }

  /**
   * Get client partials configuration
   * @returns {Object} Client partials configuration
   */
  get partials() {
    return {
      message: true,
      channel: true,
      reaction: true,
      guildMember: true,
      user: true,
    };
  }

  /**
   * Get cache limits configuration
   * @returns {Object} Cache limits configuration
   */
  get cacheLimits() {
    return {
      MessageManager: 25,
      ChannelManager: 100,
      GuildManager: 10,
      UserManager: 100,
    };
  }

  /**
   * Parse bot owners from environment variable
   * @returns {string[]} Array of bot owner IDs
   */
  parseBotOwners() {
    const botOwners = process.env.BOT_OWNERS;
    if (!botOwners) return [];

    return botOwners
      .split(",")
      .map(id => id.trim())
      .filter(id => id);
  }

  /**
   * Get all configuration as a single object
   * @returns {Object} Complete configuration object
   */
  getAll() {
    return {
      discord: this.discord,
      database: this.database,
      logging: this.logging,
      intents: this.intents,
      partials: this.partials,
      cacheLimits: this.cacheLimits,
    };
  }

  /**
   * Validate configuration
   * @returns {boolean} True if configuration is valid
   */
  validate() {
    try {
      this.validateRequiredEnvVars();
      return true;
    } catch (error) {
      console.error("Configuration validation failed:", error.message);
      return false;
    }
  }
}

// Export singleton instance
export const config = new Config();
export default config;
