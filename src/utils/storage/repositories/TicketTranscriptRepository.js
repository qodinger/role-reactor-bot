import { BaseRepository } from "./BaseRepository.js";

/**
 * Repository for managing ticket transcripts
 */
export class TicketTranscriptRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "ticket_transcripts", cache, logger);
    this._ensureIndexes();
  }

  /**
   * Create indexes for optimal query performance
   */
  async _ensureIndexes() {
    try {
      await this.collection.createIndex({ transcriptId: 1 }, { unique: true });
      await this.collection.createIndex({ ticketId: 1 });
      await this.collection.createIndex({ guildId: 1, expiresAt: 1 });
      this.logger.debug("TicketTranscriptRepository indexes ensured");
    } catch (error) {
      this.logger.debug(
        "TicketTranscriptRepository indexes already exist or error:",
        error.message,
      );
    }
  }

  /**
   * Create a new transcript
   * @param {Object} transcriptData - Transcript data
   * @returns {Promise<Object|null>} Created transcript or null
   */
  async create(transcriptData) {
    try {
      const now = new Date().toISOString();
      const transcript = {
        transcriptId: transcriptData.transcriptId,
        ticketId: transcriptData.ticketId,
        guildId: transcriptData.guildId,

        format: transcriptData.format || "html",
        content: transcriptData.content || "",

        messages: transcriptData.messages || [],

        metadata: {
          ticketOpenedAt: transcriptData.metadata?.ticketOpenedAt || null,
          ticketClosedAt: transcriptData.metadata?.ticketClosedAt || null,
          claimedBy: transcriptData.metadata?.claimedBy || null,
          totalMessages: transcriptData.metadata?.totalMessages || 0,
          duration: transcriptData.metadata?.duration || 0,
        },

        expiresAt: transcriptData.expiresAt || null,
        downloadedAt: null,

        createdAt: now,
      };

      const result = await this.collection.insertOne(transcript);

      if (result.acknowledged) {
        transcript._id = result.insertedId;
        return transcript;
      }
      return null;
    } catch (error) {
      if (error.code === 11000) {
        this.logger.warn(
          `Duplicate transcript detected: ${transcriptData.transcriptId}`,
        );
        return await this.findByTranscriptId(transcriptData.transcriptId);
      }
      this.logger.error("Failed to create transcript", error);
      return null;
    }
  }

  /**
   * Find transcript by transcript ID
   * @param {string} transcriptId - Transcript ID
   * @returns {Promise<Object|null>} Transcript document or null
   */
  async findByTranscriptId(transcriptId) {
    try {
      return await this.collection.findOne({ transcriptId });
    } catch (error) {
      this.logger.error(`Failed to find transcript ${transcriptId}`, error);
      return null;
    }
  }

  /**
   * Find transcript by ticket ID
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<Object|null>} Transcript document or null
   */
  async findByTicketId(ticketId) {
    try {
      return await this.collection.findOne({ ticketId });
    } catch (error) {
      this.logger.error(
        `Failed to find transcript for ticket ${ticketId}`,
        error,
      );
      return null;
    }
  }

  /**
   * Get all transcripts for a guild
   * @param {string} guildId - Guild ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of transcript documents
   */
  async findByGuild(guildId, options = {}) {
    try {
      const { limit = 50, skip = 0 } = options;

      return await this.collection
        .find({ guildId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    } catch (error) {
      this.logger.error(
        `Failed to find transcripts for guild ${guildId}`,
        error,
      );
      return [];
    }
  }

  /**
   * Get expired transcripts (for cleanup)
   * @param {string} guildId - Guild ID
   * @returns {Promise<Array>} Array of expired transcripts
   */
  async getExpiredTranscripts(guildId) {
    try {
      const now = new Date();

      return await this.collection
        .find({
          guildId,
          expiresAt: { $ne: null, $lt: now.toISOString() },
        })
        .toArray();
    } catch (error) {
      this.logger.error(
        `Failed to get expired transcripts for guild ${guildId}`,
        error,
      );
      return [];
    }
  }

  /**
   * Mark transcript as downloaded
   * @param {string} transcriptId - Transcript ID
   * @returns {Promise<boolean>} Success status
   */
  async markDownloaded(transcriptId) {
    try {
      const result = await this.collection.updateOne(
        { transcriptId },
        {
          $set: {
            downloadedAt: new Date().toISOString(),
          },
        },
      );
      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(
        `Failed to mark transcript downloaded ${transcriptId}`,
        error,
      );
      return false;
    }
  }

  /**
   * Delete a transcript
   * @param {string} transcriptId - Transcript ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(transcriptId) {
    try {
      const result = await this.collection.deleteOne({ transcriptId });
      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to delete transcript ${transcriptId}`, error);
      return false;
    }
  }

  /**
   * Delete transcripts by ticket ID
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteByTicketId(ticketId) {
    try {
      const result = await this.collection.deleteMany({ ticketId });
      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error(
        `Failed to delete transcripts for ticket ${ticketId}`,
        error,
      );
      return false;
    }
  }

  /**
   * Delete all transcripts for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteByGuild(guildId) {
    try {
      const result = await this.collection.deleteMany({ guildId });
      if (this.cache) this.cache.clear();
      return result.acknowledged;
    } catch (error) {
      this.logger.error(
        `Failed to delete transcripts for guild ${guildId}`,
        error,
      );
      return false;
    }
  }

  /**
   * Get transcript count for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<number>} Transcript count
   */
  async countByGuild(guildId) {
    try {
      return await this.collection.countDocuments({ guildId });
    } catch (error) {
      this.logger.error(
        `Failed to count transcripts for guild ${guildId}`,
        error,
      );
      return 0;
    }
  }

  /**
   * Get storage usage for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Storage usage stats
   */
  async getStorageUsage(guildId) {
    try {
      const pipeline = [
        { $match: { guildId } },
        {
          $group: {
            _id: null,
            totalTranscripts: { $sum: 1 },
            totalSize: { $sum: { $strLenCP: "$content" } },
          },
        },
      ];

      const results = await this.collection.aggregate(pipeline).toArray();

      if (results.length > 0) {
        return {
          totalTranscripts: results[0].totalTranscripts,
          totalSizeBytes: results[0].totalSize,
          totalSizeMB: (results[0].totalSize / 1024 / 1024).toFixed(2),
        };
      }

      return { totalTranscripts: 0, totalSizeBytes: 0, totalSizeMB: "0" };
    } catch (error) {
      this.logger.error(
        `Failed to get storage usage for guild ${guildId}`,
        error,
      );
      return { totalTranscripts: 0, totalSizeBytes: 0, totalSizeMB: "0" };
    }
  }
}
