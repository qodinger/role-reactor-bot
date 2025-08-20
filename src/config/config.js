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
        maxPoolSize: 20, // Increased from 10
        minPoolSize: 5, // Increased from 2
        maxIdleTimeMS: 60000, // Increased from 30000
        serverSelectionTimeoutMS: 15000, // Increased from 10000
        connectTimeoutMS: 15000, // Increased from 10000
        socketTimeoutMS: 60000, // Increased from 45000
        retryWrites: true,
        retryReads: true,
        w: "majority",
        // Enhanced reconnection options
        heartbeatFrequencyMS: 10000,
        // Add connection optimization
        maxConnecting: 5, // Limit concurrent connection attempts
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
      MessageManager: 100, // Increased from 25
      UserManager: 500, // Increased from 100
      GuildManager: 50, // Added for guild caching
      ChannelManager: 100, // Added for channel caching
      GuildMemberManager: 200, // Added for member caching
      RoleManager: 100, // Added for role caching
      EmojiManager: 50, // Added for emoji caching
    };
  }

  /**
   * Get rate limit configuration
   * @returns {Object} Rate limit configuration object
   */
  get rateLimits() {
    const baseConfig = {
      rest: {
        timeout: 15000,
        retries: 3,
        offset: 750,
      },
      ws: {
        properties: {
          browser: "Discord iOS",
        },
      },
    };

    // Environment-specific adjustments
    if (this.isProduction) {
      return {
        ...baseConfig,
        rest: {
          ...baseConfig.rest,
          timeout: 20000, // Longer timeout for production
          retries: 5, // More retries for production
          offset: 1000, // Larger offset for production
        },
      };
    }

    return baseConfig;
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
      rateLimits: this.rateLimits,
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
