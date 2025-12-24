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
   * Get AI model configuration
   * @returns {Object} AI model configuration object
   */
  get aiModels() {
    return {
      // Model configurations
      // Providers are checked in order - first enabled provider is used
      // Set enabled: true to use, enabled: false to disable
      providers: {
        selfhosted: {
          enabled: false, // Disabled - using OpenRouter GPT-4o-mini instead
          name: "Self-Hosted",
          baseUrl: process.env.SELF_HOSTED_API_URL || "http://127.0.0.1:11434",
          apiKey: process.env.SELF_HOSTED_API_KEY || null,
          models: {
            image: {
              primary: "default",
            },
            text: {
              primary: process.env.SELF_HOSTED_TEXT_MODEL || "llama3.1:8b",
            },
          },
        },
        stability: {
          enabled: true,
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
        openrouter: {
          enabled: true, // Enabled - using GPT-4o-mini for text/chat
          name: "OpenRouter",
          baseUrl: "https://openrouter.ai/api/v1/chat/completions",
          apiKey: process.env.OPENROUTER_API_KEY,
          models: {
            image: {
              primary: "google/gemini-3-pro-image-preview",
            },
            text: {
              primary: "openai/gpt-4o-mini", // GPT-4o-mini via OpenRouter
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
            text: {
              primary: "gpt-3.5-turbo",
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
        minimum: parseFloat(process.env.KOFI_MINIMUM_DONATION) || 10, // Minimum payment amount (default $10)
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

      // Subscription tiers (DEPRECATED - subscriptions removed)
      // Kept for legacy user support only - new subscriptions are not accepted
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

      // Avatar content filter settings
      avatarContentFilter: {
        enabled: false, // Set to true to enable content filtering, false to disable
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
