/**
 * RoleBundleManager - Manages reusable role bundles
 * @module features/rolebundles/RoleBundleManager
 */

import { getLogger } from '../../utils/logger.js';
import db from '../../utils/db.js';

class RoleBundleManager {
  constructor() {
    this.logger = getLogger();
    this.collection = null;
  }

  /**
   * Initialize the bundle manager
   */
  async init() {
    try {
      const database = await db.getDb();
      this.collection = database.collection('role_bundles');
      
      // Create indexes for better query performance
      await this.collection.createIndex({ guildId: 1, name: 1 }, { unique: true });
      
      this.logger.info('📦 RoleBundleManager initialized');
    } catch (error) {
      this.logger.error('❌ Failed to initialize RoleBundleManager:', error);
      throw error;
    }
  }

  /**
   * Create a new role bundle
   * @param {Object} options - Bundle options
   * @returns {Promise<Object>} Created bundle
   */
  async create(options) {
    try {
      const bundle = {
        _id: options._id,
        guildId: options.guildId,
        name: options.name,
        roles: options.roles, // Array of { roleId, roleName }
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.collection.insertOne(bundle);
      this.logger.info(`📦 Role bundle created: ${options.name} in guild ${options.guildId}`);
      
      return bundle;
    } catch (error) {
      this.logger.error('❌ Error creating role bundle:', error);
      throw error;
    }
  }

  /**
   * Get a bundle by name
   * @param {string} guildId - Guild ID
   * @param {string} name - Bundle name
   * @returns {Promise<Object|null>}
   */
  async getByName(guildId, name) {
    try {
      return await this.collection.findOne({ guildId, name });
    } catch (error) {
      this.logger.error('❌ Error getting bundle by name:', error);
      throw error;
    }
  }

  /**
   * Get all bundles for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<Array>}
   */
  async getAllForGuild(guildId) {
    try {
      return await this.collection.find({ guildId }).toArray();
    } catch (error) {
      this.logger.error('❌ Error getting bundles for guild:', error);
      throw error;
    }
  }

  /**
   * Delete a bundle by name
   * @param {string} guildId - Guild ID
   * @param {string} name - Bundle name
   * @returns {Promise<Object>} Result
   */
  async deleteByName(guildId, name) {
    try {
      const result = await this.collection.deleteOne({ guildId, name });
      
      if (result.deletedCount === 0) {
        return { success: false, error: 'Bundle not found' };
      }

      this.logger.info(`🗑️ Role bundle deleted: ${name} in guild ${guildId}`);
      return { success: true };
    } catch (error) {
      this.logger.error('❌ Error deleting bundle:', error);
      throw error;
    }
  }

  /**
   * Check if bundle name exists
   * @param {string} guildId - Guild ID
   * @param {string} name - Bundle name
   * @returns {Promise<boolean>}
   */
  async exists(guildId, name) {
    try {
      const bundle = await this.collection.findOne({ guildId, name });
      return bundle !== null;
    } catch (error) {
      this.logger.error('❌ Error checking bundle existence:', error);
      throw error;
    }
  }

  /**
   * Validate bundle name
   * @param {string} name - Bundle name
   * @returns {Object} Validation result
   */
  validateName(name) {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Bundle name is required' };
    }

    if (name.length > 50) {
      return { valid: false, error: 'Bundle name must be less than 50 characters' };
    }

    // Allow letters, numbers, spaces, hyphens, underscores
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
      return { 
        valid: false, 
        error: 'Bundle name can only contain letters, numbers, spaces, hyphens, and underscores' 
      };
    }

    return { valid: true };
  }
}

// Export singleton instance
const roleBundleManager = new RoleBundleManager();

export default roleBundleManager;
export { RoleBundleManager };
