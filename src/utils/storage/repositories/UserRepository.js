import { BaseRepository } from "./BaseRepository.js";

/**
 * Repository for managing user authentication and profile data
 * Stores Discord OAuth users who have authenticated on the website
 */
export class UserRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "users", cache, logger);
    this._ensureIndexes();
  }

  /**
   * Create indexes for optimal query performance
   */
  async _ensureIndexes() {
    try {
      await this.collection.createIndex({ discordId: 1 }, { unique: true });
      await this.collection.createIndex({ email: 1 }, { sparse: true });
      await this.collection.createIndex({ createdAt: 1 });
      this.logger.debug("UserRepository indexes ensured");
    } catch (error) {
      // Indexes may already exist
      this.logger.debug("UserRepository indexes already exist or error:", error.message);
    }
  }

  /**
   * Find user by Discord ID
   * @param {string} discordId - Discord user ID
   * @returns {Promise<Object|null>} User document or null
   */
  async findByDiscordId(discordId) {
    try {
      const cacheKey = `user_discord_${discordId}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const user = await this.collection.findOne({ discordId });
      if (user) {
        this.cache.set(cacheKey, user);
      }
      return user;
    } catch (error) {
      this.logger.error(`Failed to find user by Discord ID ${discordId}`, error);
      return null;
    }
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User document or null
   */
  async findByEmail(email) {
    try {
      if (!email) return null;
      const normalizedEmail = email.toLowerCase().trim();
      return await this.collection.findOne({ email: normalizedEmail });
    } catch (error) {
      this.logger.error(`Failed to find user by email`, error);
      return null;
    }
  }

  /**
   * Create or update user from Discord OAuth
   * Stores user info and encrypted tokens for dashboard features
   * @param {Object} userData - User data from Discord OAuth
   * @returns {Promise<Object|null>} Created/updated user
   */
  async upsertFromDiscordOAuth(userData) {
    try {
      const {
        discordId,
        username,
        discriminator,
        email,
        avatar,
        globalName,
        accessToken,
        refreshToken,
        tokenExpiresAt,
      } = userData;

      // Import encryption utilities
      const { encryptToken } = await import("../../crypto/tokenEncryption.js");

      const now = new Date().toISOString();
      const updateData = {
        discordId,
        username,
        discriminator: discriminator || "0",
        globalName: globalName || username, // Display name
        avatar,
        lastLogin: now,
        updatedAt: now,
      };

      // Only update email if provided (requires email scope)
      if (email) {
        updateData.email = email.toLowerCase().trim();
      }

      // Encrypt and store tokens if provided
      if (accessToken) {
        updateData.accessToken = encryptToken(accessToken);
        updateData.tokenExpiresAt = tokenExpiresAt || null;
      }
      if (refreshToken) {
        updateData.refreshToken = encryptToken(refreshToken);
      }

      const result = await this.collection.findOneAndUpdate(
        { discordId },
        {
          $set: updateData,
          $setOnInsert: { createdAt: now },
        },
        { upsert: true, returnDocument: "after" },
      );

      // Invalidate cache
      this.cache.delete(`user_discord_${discordId}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to upsert user from Discord OAuth`, error);
      return null;
    }
  }

  /**
   * Get decrypted access token for a user
   * @param {string} discordId - Discord user ID
   * @returns {Promise<string|null>} Decrypted access token or null
   */
  async getAccessToken(discordId) {
    try {
      const user = await this.findByDiscordId(discordId);
      if (!user?.accessToken) return null;

      const { decryptToken } = await import("../../crypto/tokenEncryption.js");
      return decryptToken(user.accessToken);
    } catch (error) {
      this.logger.error(`Failed to get access token for ${discordId}`, error);
      return null;
    }
  }

  /**
   * Get decrypted refresh token for a user
   * @param {string} discordId - Discord user ID
   * @returns {Promise<string|null>} Decrypted refresh token or null
   */
  async getRefreshToken(discordId) {
    try {
      const user = await this.findByDiscordId(discordId);
      if (!user?.refreshToken) return null;

      const { decryptToken } = await import("../../crypto/tokenEncryption.js");
      return decryptToken(user.refreshToken);
    } catch (error) {
      this.logger.error(`Failed to get refresh token for ${discordId}`, error);
      return null;
    }
  }

  /**
   * Update user's OAuth tokens (after refresh)
   * @param {string} discordId - Discord user ID
   * @param {Object} tokens - New tokens
   * @returns {Promise<boolean>} Success status
   */
  async updateTokens(discordId, tokens) {
    try {
      const { encryptToken } = await import("../../crypto/tokenEncryption.js");

      const updateData = {
        updatedAt: new Date().toISOString(),
      };

      if (tokens.accessToken) {
        updateData.accessToken = encryptToken(tokens.accessToken);
      }
      if (tokens.refreshToken) {
        updateData.refreshToken = encryptToken(tokens.refreshToken);
      }
      if (tokens.expiresAt) {
        updateData.tokenExpiresAt = tokens.expiresAt;
      }

      const result = await this.collection.updateOne(
        { discordId },
        { $set: updateData },
      );

      this.cache.delete(`user_discord_${discordId}`);
      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to update tokens for ${discordId}`, error);
      return false;
    }
  }

  /**
   * Check if user's access token is expired
   * @param {string} discordId - Discord user ID
   * @returns {Promise<boolean>} Whether token is expired
   */
  async isTokenExpired(discordId) {
    try {
      const user = await this.findByDiscordId(discordId);
      if (!user?.tokenExpiresAt) return true;

      return new Date(user.tokenExpiresAt) < new Date();
    } catch (error) {
      this.logger.error(`Failed to check token expiry for ${discordId}`, error);
      return true;
    }
  }

  /**
   * Update user profile
   * @param {string} discordId - Discord user ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<boolean>} Success status
   */
  async updateProfile(discordId, updates) {
    try {
      const result = await this.collection.updateOne(
        { discordId },
        {
          $set: {
            ...updates,
            updatedAt: new Date().toISOString(),
          },
        },
      );

      this.cache.delete(`user_discord_${discordId}`);
      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to update user profile ${discordId}`, error);
      return false;
    }
  }

  /**
   * Get user count
   * @returns {Promise<number>} Total user count
   */
  async count() {
    try {
      return await this.collection.countDocuments();
    } catch (error) {
      this.logger.error("Failed to count users", error);
      return 0;
    }
  }

  /**
   * Get recently active users
   * @param {number} limit - Maximum users to return
   * @returns {Promise<Array>} Array of user documents
   */
  async getRecentlyActive(limit = 10) {
    try {
      return await this.collection
        .find({})
        .sort({ lastLogin: -1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      this.logger.error("Failed to get recently active users", error);
      return [];
    }
  }
}
