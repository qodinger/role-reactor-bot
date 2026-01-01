import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Configuration management class following Discord API best practices
 */
class Config {
  constructor() {
    // Don't validate on construction - allow lazy validation
    // This allows the config to be imported even if env vars aren't set yet
    this._validated = false;
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
    const requiredVars = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID"];
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
      clientId: process.env.DISCORD_CLIENT_ID,
      guildId: process.env.DISCORD_GUILD_ID,
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
        // Connection pool settings - optimized for cost savings on MongoDB Atlas Flex
        // Lower minPoolSize = lower compute usage = lower costs
        // Can be overridden via MONGODB_MIN_POOL_SIZE and MONGODB_MAX_POOL_SIZE env vars
        maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || "20", 10),
        minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || "2", 10), // Reduced from 5 to 2 for cost savings
        maxIdleTimeMS: 60000,
        serverSelectionTimeoutMS: 30000, // Increased for DNS resolution
        connectTimeoutMS: 30000, // Increased for DNS resolution
        socketTimeoutMS: 60000,
        retryWrites: true,
        retryReads: true,
        w: "majority",
        // Enhanced reconnection options
        heartbeatFrequencyMS: 10000,
        // Add connection optimization
        maxConnecting: parseInt(process.env.MONGODB_MAX_CONNECTING || "5", 10), // Limit concurrent connection attempts
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
   * Get cache limits configuration
   * @returns {Object} Cache limits configuration object
   */
  get cacheLimits() {
    return {
      MessageManager: 200, // Increased from 100
      UserManager: 1000, // Increased from 500
      // Note: GuildManager, ChannelManager, and RoleManager cannot be overridden
      // They are managed internally by discord.js
      GuildMemberManager: 500, // Increased from 200
      EmojiManager: 100, // Increased from 50
      // Add new cache managers
      ApplicationCommandManager: 50,
      GuildScheduledEventManager: 25,
      StageInstanceManager: 25,
      ThreadManager: 100,
      VoiceStateManager: 200,
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
        // Enhanced rate limiting
        globalLimit: 50, // Global requests per second
        userLimit: 10, // Per-user requests per second
        guildLimit: 20, // Per-guild requests per second
      },
      ws: {
        properties: {
          browser: "Discord iOS",
        },
        // WebSocket rate limiting
        heartbeatInterval: 41250, // Discord's recommended interval
        maxReconnectAttempts: 5,
        reconnectDelay: 1000,
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
          globalLimit: 100, // Higher limits for production
          userLimit: 20,
          guildLimit: 40,
        },
        ws: {
          ...baseConfig.ws,
          maxReconnectAttempts: 10, // More reconnection attempts for production
          reconnectDelay: 500, // Faster reconnection for production
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
    const developers = process.env.DISCORD_DEVELOPERS;
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
      name: "Role Reactor Bot",
      website: "https://rolereactor.app",
      guide: "https://rolereactor.app/docs",
      github: "https://github.com/qodinger/role-reactor-bot",
      support: "https://discord.gg/D8tYkU75Ry",
      sponsor: "https://rolereactor.app/sponsor",
      invite: null, // Will be generated dynamically by the bot
    };
  }

  /**
   * Get AI model configuration (delegated to ai.js)
   * @returns {Object} AI model configuration object
   * @deprecated Use getAIModels() from './ai.js' instead
   */
  get aiModels() {
    return {
      providers: {
        openrouter: { enabled: false },
        openai: { enabled: false },
        stability: { enabled: false },
        selfhosted: { enabled: false },
      },
    };
  }

  /**
   * Get Core pricing configuration
   * @returns {Object} Core pricing configuration object
   */
  get corePricing() {
    return {
      // Package plans for display in /core pricing command
      // Base value is consistent across all packages
      // Larger packages get bonus Cores as incentive
      packages: {
        $5: {
          name: "Core",
          baseCores: 80,
          bonusCores: 0,
          value: "16 Cores/$1",
        },
        $10: {
          name: "Edge",
          baseCores: 160,
          bonusCores: 20,
          value: "18 Cores/$1",
        },
        $25: {
          name: "Prime",
          baseCores: 400,
          bonusCores: 100,
          value: "20 Cores/$1",
        },
        $50: {
          name: "Ultra",
          baseCores: 800,
          bonusCores: 300,
          value: "22 Cores/$1",
        },
      },

      // Moderation auto-escalation thresholds
      // Set to 0 to disable auto-escalation
      autoEscalation: {
        timeoutAfterWarnings:
          parseInt(process.env.MODERATION_TIMEOUT_AFTER_WARNINGS, 10) || 3, // Auto-timeout after 3 warnings
        kickAfterWarnings:
          parseInt(process.env.MODERATION_KICK_AFTER_WARNINGS, 10) || 5, // Auto-kick after 5 warnings
        timeoutDuration: process.env.MODERATION_AUTO_TIMEOUT_DURATION || "1h", // Duration for auto-timeout
      },

      // Core system settings
      coreSystem: {
        minimumPayment: 5, // Minimum $5 for one-time payments
        priorityProcessing: true, // Core members get priority (planned feature)
      },

      // Feature costs and avatar filter moved to config/ai.js
      // Kept here for backward compatibility
      featureCosts: {
        aiChat: 0.02,
        aiImage: 1,
      },
      avatarContentFilter: {
        enabled: false,
      },
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
      cacheLimits: this.cacheLimits,
      rateLimits: this.rateLimits,
      aiModels: this.aiModels,
      corePricing: this.corePricing,
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
    } catch (_error) {
      return false;
    }
  }
}

// Export singleton instance
export const config = new Config();
export default config;
