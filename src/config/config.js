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
   * Get caching configuration
   * @returns {Object} Caching configuration object
   */
  get caching() {
    return {
      // Member cache settings
      memberCache: {
        ttl: 5 * 60 * 1000, // 5 minutes
        maxSize: 1000,
        cleanupInterval: 5 * 60 * 1000, // 5 minutes
      },
      // Role mapping cache settings
      roleMappingCache: {
        ttl: 15 * 60 * 1000, // 15 minutes
        maxSize: 500,
        refreshInterval: 5 * 60 * 1000, // 5 minutes
        cleanupInterval: 15 * 60 * 1000, // 15 minutes
      },
      // Experience cache settings
      experienceCache: {
        ttl: 10 * 60 * 1000, // 10 minutes
        maxSize: 2000,
        batchDelay: 5000, // 5 seconds
        cleanupInterval: 10 * 60 * 1000, // 10 minutes
      },
      // Database query cache settings
      queryCache: {
        ttl: 2 * 60 * 1000, // 2 minutes
        maxSize: 500,
        cleanupInterval: 5 * 60 * 1000, // 5 minutes
      },
      // General cache settings
      general: {
        ttl: 5 * 60 * 1000, // 5 minutes
        maxSize: 1000,
        cleanupInterval: 5 * 60 * 1000, // 5 minutes
      },
    };
  }

  /**
   * Get batch operation configuration
   * @returns {Object} Batch operation configuration object
   */
  get batchOperations() {
    return {
      // Role operations
      roleAdd: {
        batchSize: 5,
        delay: 100, // 100ms between batches
        maxConcurrent: 3,
      },
      roleRemove: {
        batchSize: 5,
        delay: 100,
        maxConcurrent: 3,
      },
      // Member operations
      memberFetch: {
        batchSize: 10,
        delay: 50, // 50ms between batches
        maxConcurrent: 5,
      },
      // Message operations
      messageSend: {
        batchSize: 3,
        delay: 200, // 200ms between batches
        maxConcurrent: 2,
      },
      // Reaction operations
      reactionAdd: {
        batchSize: 10,
        delay: 50,
        maxConcurrent: 5,
      },
    };
  }

  /**
   * Get API optimization configuration
   * @returns {Object} API optimization configuration object
   */
  get apiOptimization() {
    return {
      // Enable/disable optimizations
      enabled: true,
      // Bulk operations
      bulkOperations: {
        enabled: true,
        maxBatchSize: 10,
        defaultDelay: 100,
      },
      // Caching strategies
      caching: {
        enabled: true,
        aggressive: this.isProduction, // More aggressive caching in production
        preload: this.isProduction, // Preload frequently accessed data in production
      },
      // Rate limiting
      rateLimiting: {
        enabled: true,
        adaptive: this.isProduction, // Adaptive rate limiting in production
        backoff: this.isProduction, // Exponential backoff in production
      },
      // Connection pooling
      connectionPooling: {
        enabled: true,
        maxConnections: this.isProduction ? 50 : 20,
        minConnections: this.isProduction ? 10 : 5,
        idleTimeout: 60000,
      },
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
      name: "Role Reactor Bot",
      guide: "https://rolereactor.app/docs",
      github: "https://github.com/qodinger/role-reactor-bot",
      support: "https://discord.gg/D8tYkU75Ry",
      sponsor: "https://rolereactor.app/sponsor",
      invite: null, // Will be generated dynamically by the bot
    };
  }

  /**
   * Get AI model configuration
   * @returns {Object} AI model configuration object
   */
  get aiModels() {
    return {
      // Model configurations
      // Providers are checked in order - first enabled provider is used
      // Set enabled: true to use, enabled: false to disable
      providers: {
        openrouter: {
          enabled: false, // Set to false to disable this provider
          name: "OpenRouter",
          baseUrl: "https://openrouter.ai/api/v1/chat/completions",
          apiKey: process.env.OPENROUTER_API_KEY,
          models: {
            image: {
              primary: "google/gemini-3-pro-image-preview",
            },
          },
        },
        openai: {
          enabled: false, // Set to true to enable this provider
          name: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          apiKey: process.env.OPENAI_API_KEY,
          models: {
            image: {
              primary: "dall-e-3",
            },
          },
        },
        stability: {
          enabled: true, // Set to true to enable this provider
          name: "Stability AI",
          baseUrl: "https://api.stability.ai/v2beta/stable-image/generate/sd3",
          apiKey: process.env.STABILITY_API_KEY,
          models: {
            image: {
              primary: "sd3.5-flash", // Fastest and cheapest
              large: "sd3.5-large", // Highest quality
              medium: "sd3.5-medium", // Balanced
              turbo: "sd3.5-large-turbo", // Quality + Speed
            },
          },
        },
      },
    };
  }

  /**
   * Get Core pricing configuration
   * @returns {Object} Core pricing configuration object
   */
  get corePricing() {
    return {
      // AI generation cost per image (Stability AI SD 3.5 Flash)
      aiCostPerImage: 0.025, // $0.025 per image with SD 3.5 Flash

      // Donation rates (Cores per $1) - Your preferred rates
      donation: {
        rate: 10, // 10 Cores per $1
        minimum: parseFloat(process.env.KOFI_MINIMUM_DONATION) || 1, // Minimum donation amount (default $1)
      },

      // Subscription tiers (monthly) - Your preferred rates
      subscriptions: {
        Bronze: {
          price: 5,
          cores: 50, // 10.0 Cores per $1 (test tier)
          description: "Bronze test membership - INTERNAL TESTING ONLY",
        },
        "Core Basic": {
          price: 10,
          cores: 150, // 15.0 Cores per $1
          description: "Basic Core membership",
        },
        "Core Premium": {
          price: 25,
          cores: 400, // 16.0 Cores per $1
          description: "Premium Core membership",
        },
        "Core Elite": {
          price: 50,
          cores: 850, // 17.0 Cores per $1
          description: "Elite Core membership",
        },
      },

      // Core system settings
      coreSystem: {
        minimumSubscription: 5, // Minimum $5 for Core membership (includes Bronze test tier)
        aiServiceCost: 1, // 1 Core per AI service
        priorityProcessing: true, // Core members get priority
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
      intents: this.intents,
      partials: this.partials,
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
