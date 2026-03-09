import { BaseRepository } from "./BaseRepository.js";

/**
 * Repository for managing ticket panels
 */
export class TicketPanelRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "ticket_panels", cache, logger);
    this._ensureIndexes();
  }

  /**
   * Create indexes for optimal query performance
   */
  async _ensureIndexes() {
    try {
      await this.collection.createIndex({ panelId: 1 }, { unique: true });
      await this.collection.createIndex({ guildId: 1 });
      await this.collection.createIndex(
        { messageId: 1 },
        { unique: true, sparse: true },
      );
      this.logger.debug("TicketPanelRepository indexes ensured");
    } catch (error) {
      this.logger.debug(
        "TicketPanelRepository indexes already exist or error:",
        error.message,
      );
    }
  }

  /**
   * Create a new ticket panel
   * @param {Object} panelData - Panel data
   * @returns {Promise<Object|null>} Created panel or null
   */
  async create(panelData) {
    try {
      const now = new Date().toISOString();
      const panel = {
        panelId: panelData.panelId,
        guildId: panelData.guildId,

        messageId: panelData.messageId || null,
        channelId: panelData.channelId || null,

        title: panelData.title || "Support Tickets",
        description:
          panelData.description || "Click a button below to create a ticket",

        categories: panelData.categories || [],

        settings: {
          enabled: panelData.settings?.enabled ?? true,
          showTicketCount: panelData.settings?.showTicketCount ?? true,
          showWaitTime: panelData.settings?.showWaitTime ?? false,
          requireReason: panelData.settings?.requireReason ?? false,
          allowMultiple: panelData.settings?.allowMultiple ?? false,
          autoCloseDays: panelData.settings?.autoCloseDays ?? 7,
          transcriptChannelId: panelData.settings?.transcriptChannelId || null,
        },

        styling: {
          color: panelData.styling?.color ?? 0x5865f2,
          footer: panelData.styling?.footer || null,
          thumbnail: panelData.styling?.thumbnail || null,
          image: panelData.styling?.image || null,
          proBranding: panelData.styling?.proBranding ?? false,
        },

        stats: {
          totalTickets: 0,
          openTickets: 0,
          avgCloseTime: 0,
        },

        createdAt: now,
        updatedAt: now,
      };

      const result = await this.collection.insertOne(panel);

      if (result.acknowledged) {
        panel._id = result.insertedId;
        return panel;
      }
      return null;
    } catch (error) {
      if (error.code === 11000) {
        this.logger.warn(`Duplicate panel detected: ${panelData.panelId}`);
        return await this.findByPanelId(panelData.panelId);
      }
      this.logger.error("Failed to create ticket panel", error);
      return null;
    }
  }

  /**
   * Find panel by panel ID
   * @param {string} panelId - Panel ID
   * @returns {Promise<Object|null>} Panel document or null
   */
  async findByPanelId(panelId) {
    try {
      return await this.collection.findOne({ panelId });
    } catch (error) {
      this.logger.error(`Failed to find panel ${panelId}`, error);
      return null;
    }
  }

  /**
   * Find panel by message ID
   * @param {string} messageId - Discord message ID
   * @returns {Promise<Object|null>} Panel document or null
   */
  async findByMessageId(messageId) {
    try {
      return await this.collection.findOne({ messageId });
    } catch (error) {
      this.logger.error(`Failed to find panel by message ${messageId}`, error);
      return null;
    }
  }

  /**
   * Get all panels for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<Array>} Array of panel documents
   */
  async findByGuild(guildId) {
    try {
      return await this.collection.find({ guildId }).toArray();
    } catch (error) {
      this.logger.error(`Failed to find panels for guild ${guildId}`, error);
      return [];
    }
  }

  /**
   * Get panel count for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<number>} Panel count
   */
  async countByGuild(guildId) {
    try {
      return await this.collection.countDocuments({ guildId });
    } catch (error) {
      this.logger.error(`Failed to count panels for guild ${guildId}`, error);
      return 0;
    }
  }

  /**
   * Update panel
   * @param {string} panelId - Panel ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<boolean>} Success status
   */
  async update(panelId, updateData) {
    try {
      const result = await this.collection.updateOne(
        { panelId },
        {
          $set: {
            ...updateData,
            updatedAt: new Date().toISOString(),
          },
        },
      );
      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to update panel ${panelId}`, error);
      return false;
    }
  }

  /**
   * Update panel message reference
   * @param {string} panelId - Panel ID
   * @param {string} messageId - Discord message ID
   * @param {string} channelId - Discord channel ID
   * @returns {Promise<boolean>} Success status
   */
  async updateMessageRef(panelId, messageId, channelId) {
    try {
      const result = await this.collection.updateOne(
        { panelId },
        {
          $set: {
            messageId,
            channelId,
            updatedAt: new Date().toISOString(),
          },
        },
      );
      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to update panel message ref ${panelId}`, error);
      return false;
    }
  }

  /**
   * Update panel stats
   * @param {string} panelId - Panel ID
   * @param {Object} stats - Stats to update
   * @returns {Promise<boolean>} Success status
   */
  async updateStats(panelId, stats) {
    try {
      const result = await this.collection.updateOne(
        { panelId },
        {
          $set: {
            stats,
            updatedAt: new Date().toISOString(),
          },
        },
      );
      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to update panel stats ${panelId}`, error);
      return false;
    }
  }

  /**
   * Delete a panel
   * @param {string} panelId - Panel ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(panelId) {
    try {
      const result = await this.collection.deleteOne({ panelId });
      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to delete panel ${panelId}`, error);
      return false;
    }
  }

  /**
   * Enable/disable panel
   * @param {string} panelId - Panel ID
   * @param {boolean} enabled - Enable status
   * @returns {Promise<boolean>} Success status
   */
  async setEnabled(panelId, enabled) {
    try {
      const result = await this.collection.updateOne(
        { panelId },
        {
          $set: {
            "settings.enabled": enabled,
            updatedAt: new Date().toISOString(),
          },
        },
      );
      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to set panel enabled ${panelId}`, error);
      return false;
    }
  }
}
