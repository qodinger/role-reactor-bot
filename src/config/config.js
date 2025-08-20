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
      developers: this.parseDevelopers(),
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
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        retryReads: true,
        w: "majority",
        // Enhanced reconnection options
        heartbeatFrequencyMS: 10000,
        serverApi: {
          version: "1",
          strict: false,
          deprecationErrors: false,
        },
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
      UserManager: 100,
    };
  }

  /**
   * Parse developers from environment variable
   * @returns {string[]} Array of developer IDs
   */
  parseDevelopers() {
    const developers = process.env.DEVELOPERS;
    if (!developers) return [];

    return developers
      .split(",")
      .map(id => id.trim())
      .filter(id => id);
  }

  /**
   * Get external links for help UI
   * @returns {Object} External links object
   */
  get externalLinks() {
    return {
      guide: "https://rolereactor.app/docs",
      github: "https://github.com/qodinger/role-reactor-bot",
      support: "https://discord.gg/D8tYkU75Ry",
      invite: null, // Will be generated dynamically by the bot
    };
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
