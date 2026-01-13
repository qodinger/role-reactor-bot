import dotenv from "dotenv";
import { getAIFeatureCosts, getAvatarContentFilter } from "./ai.js";

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
        // Connection pool settings - optimized for resource efficiency on MongoDB Atlas Flex
        // Lower minPoolSize = lower resource usage = better efficiency
        // Can be overridden via MONGODB_MIN_POOL_SIZE and MONGODB_MAX_POOL_SIZE env vars
        maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || "20", 10),
        minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || "2", 10), // Reduced from 5 to 2 for efficiency
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
   * Get Core pricing configuration
   * @returns {Object} Core pricing configuration object
   */
  get corePricing() {
    return {
      // Package plans for display in /core pricing command
      // Simplified package structure with 4 strategic options
      // Only 4 strategic packages to avoid choice overload
      //
      // PRICING STRATEGY:
      // - AI values Core at 2.0¢ each (50x conversion rate)
      // - Packages sell Cores at 5.71¢-6.25¢ each (185-213% markup)
      // - Markup covers operational costs, development, support, and profit
      // - Usage estimates based on actual AI costs: 0.01 Core/chat, 2.1 Core/image
      packages: {
        $5: {
          name: "Starter",
          baseCores: 75,
          bonusCores: 5, // 7% bonus
          totalCores: 80,
          value: "16.0 Cores/$1",
          description: "Perfect for trying AI features",
          estimatedUsage: "~8,000 chat messages or 38 images",
          popular: false,
        },
        $10: {
          name: "Basic",
          baseCores: 150,
          bonusCores: 15, // 10% bonus
          totalCores: 165,
          value: "16.5 Cores/$1",
          description: "Most popular choice for regular users",
          estimatedUsage: "~16,500 chat messages or 78 images",
          popular: true, // Mark as most popular
        },
        $25: {
          name: "Pro",
          baseCores: 375,
          bonusCores: 50, // 13% bonus
          totalCores: 425,
          value: "17.0 Cores/$1",
          description: "Best value for power users",
          estimatedUsage: "~42,500 chat messages or 202 images",
          popular: false,
        },
        $50: {
          name: "Ultimate",
          baseCores: 750,
          bonusCores: 125, // 17% bonus
          totalCores: 875,
          value: "17.5 Cores/$1",
          description: "Maximum value for heavy usage",
          estimatedUsage: "~87,500 chat messages or 416 images",
          features: ["Priority processing", "Dedicated support"],
          popular: false,
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

      // Core system settings with advanced features
      coreSystem: {
        minimumPayment: 3, // Reduced minimum to $3 for accessibility
        priorityProcessing: true, // Core members get priority (planned feature)

        // Advanced pricing features
        dynamicPricing: {
          enabled: true,
          peakHours: [18, 19, 20, 21, 22], // 6-10 PM peak hours
          peakMultiplier: 1.2, // 20% higher during peak
          offPeakDiscount: 0.9, // 10% discount during off-peak
        },

        // All usage requires Cores (no free tier)
        freeTier: {
          enabled: false, // Disabled - all usage requires credits
          message:
            "Purchase Cores to start using AI features! Packages start at just $3.",
        },

        // Trial system - limited to encourage purchases
        trialSystem: {
          enabled: true,
          newUserBonus: 3, // Only 3 Cores ($0.20 value) for verified new users
          oneTimeOnly: true, // Only once per user
          requiresVerification: true, // Require phone/email verification
          maxUsage: {
            chat: 1, // Only 1 trial chat
            images: 0, // NO trial images (too expensive)
          },
        },

        // Referral system
        referralSystem: {
          enabled: true,
          referrerBonus: 0.15, // 15% bonus Cores for referrer
          refereeBonus: 0.1, // 10% bonus Cores for new user
          minimumPurchase: 10, // Minimum $10 purchase to trigger referral
        },

        // Seasonal promotions
        promotions: {
          enabled: true,
          types: [
            {
              name: "First Purchase Bonus",
              type: "first_purchase",
              bonus: 0.25, // 25% bonus on first purchase
              maxBonus: 50, // Maximum 50 bonus Cores
            },
            {
              name: "Weekend Special",
              type: "weekend",
              bonus: 0.15, // 15% bonus on weekends
              days: [6, 0], // Saturday and Sunday
            },
          ],
        },
      },

      // Feature credits and avatar filter from standardized AI config
      // These reference the centralized AI pricing configuration
      // AI Core value: 2.0¢ each (50x conversion rate)
      featureCosts: getAIFeatureCosts(),
      avatarContentFilter: getAvatarContentFilter(),
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
