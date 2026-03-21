import { getStorageManager } from "../../utils/storage/storageManager.js";
import { getPremiumManager } from "../premium/PremiumManager.js";
import { getLogger } from "../../utils/logger.js";
import { FREE_TIER, PRO_ENGINE } from "./config.js";

const logger = getLogger();

/**
 * TicketManager - Core business logic for ticketing system
 */
export class TicketManager {
  constructor() {
    this.storage = null;
    this.premiumManager = null;
    this._initialized = false;
  }

  /**
   * Initialize ticket manager
   */
  async initialize() {
    if (this._initialized) return;
    this.storage = await getStorageManager();
    this.premiumManager = getPremiumManager();
    this._initialized = true;
    logger.info("🎫 TicketManager initialized");
  }

  /**
   * Check if guild has reached ticket limit
   * @param {string} guildId - Guild ID
   * @returns {Promise<{hasReachedLimit: boolean, current: number, max: number, isPro: boolean}>}
   */
  async checkTicketLimit(guildId) {
    try {
      const isPro = await this.premiumManager.isFeatureActive(
        guildId,
        "pro_engine",
      );
      const maxTickets = isPro
        ? PRO_ENGINE.MAX_TICKETS_PER_MONTH
        : FREE_TIER.MAX_TICKETS_PER_MONTH;

      const currentTickets = await this.storage.countMonthlyTickets(guildId);

      return {
        hasReachedLimit: currentTickets >= maxTickets,
        current: currentTickets,
        max: maxTickets,
        isPro,
      };
    } catch (error) {
      logger.error("Failed to check ticket limit:", error);
      return {
        hasReachedLimit: false,
        current: 0,
        max: FREE_TIER.MAX_TICKETS_PER_MONTH,
        isPro: false,
      };
    }
  }

  /**
   * Create a new ticket
   * @param {Object} options - Ticket options
   * @returns {Promise<Object|null>} Created ticket or null
   */
  async createTicket({
    guildId,
    channelId,
    userId,
    userDisplayName,
    categoryId = "default",
  }) {
    try {
      // Check ticket limit
      const limitCheck = await this.checkTicketLimit(guildId);
      if (limitCheck.hasReachedLimit) {
        throw new Error(
          `Ticket limit reached (${limitCheck.current}/${limitCheck.max}). Upgrade to **Pro Engine ✨** for more! Enable it on our **[website](https://rolereactor.app)** using Cores.`,
        );
      }

      const ticketNumber =
        await this.storage.dbManager.guildSettings.incrementCounter(
          guildId,
          "counters.ticket",
        );
      const ticketId = `TIX-${guildId}-${ticketNumber.toString().padStart(4, "0")}`;

      // Create ticket
      const ticket = await this.storage.createTicket({
        ticketId,
        guildId,
        channelId,
        userId,
        userDisplayName,
        categoryId,
        channelName: `ticket-${ticketNumber}`,
      });

      if (!ticket) {
        throw new Error("Failed to create ticket in database");
      }

      logger.info(
        `Ticket created: ${ticketId} for user ${userId} in guild ${guildId}`,
      );
      return ticket;
    } catch (error) {
      logger.error("Failed to create ticket:", error);
      return null;
    }
  }

  /**
   * Close a ticket
   * @param {string} ticketId - Ticket ID
   * @param {string} closedBy - User ID who closed
   * @param {string} reason - Close reason
   * @returns {Promise<boolean>} Success status
   */
  async closeTicket(ticketId, closedBy, reason = null) {
    try {
      const ticket = await this.storage.getTicket(ticketId);
      if (!ticket) {
        throw new Error("Ticket not found");
      }

      const success = await this.storage.closeTicket(ticketId, {
        closedBy,
        reason,
      });

      if (success) {
        logger.info(`Ticket closed: ${ticketId} by ${closedBy}`);
      }

      return success;
    } catch (error) {
      logger.error("Failed to close ticket:", error);
      return false;
    }
  }

  /**
   * Claim a ticket
   * @param {string} ticketId - Ticket ID
   * @param {string} staffId - Staff user ID
   * @returns {Promise<boolean>} Success status
   */
  async claimTicket(ticketId, staffId) {
    try {
      const ticket = await this.storage.getTicket(ticketId);
      if (!ticket) {
        throw new Error("Ticket not found");
      }

      if (ticket.claimedBy) {
        throw new Error("Ticket already claimed");
      }

      const success = await this.storage.claimTicket(ticketId, staffId);

      if (success) {
        logger.info(`Ticket claimed: ${ticketId} by ${staffId}`);
      }

      return success;
    } catch (error) {
      logger.error("Failed to claim ticket:", error);
      return false;
    }
  }

  /**
   * Transfer a ticket to another staff member
   * @param {string} ticketId - Ticket ID
   * @param {string} newStaffId - New staff user ID
   * @returns {Promise<boolean>} Success status
   */
  async transferTicket(ticketId, newStaffId) {
    try {
      const ticket = await this.storage.getTicket(ticketId);
      if (!ticket) {
        throw new Error("Ticket not found");
      }

      // Unclaim first, then claim with new staff
      await this.storage.claimTicket(ticketId, null);
      const success = await this.storage.claimTicket(ticketId, newStaffId);

      if (success) {
        logger.info(`Ticket transferred: ${ticketId} to ${newStaffId}`);
      }

      return success;
    } catch (error) {
      logger.error("Failed to transfer ticket:", error);
      return false;
    }
  }

  /**
   * Add user to ticket
   * @param {string} ticketId - Ticket ID
   * @param {string} userId - User ID to add
   * @returns {Promise<boolean>} Success status
   */
  async addUserToTicket(ticketId, userId) {
    try {
      const ticket = await this.storage.getTicket(ticketId);
      if (!ticket) {
        throw new Error("Ticket not found");
      }

      const success = await this.storage.addTicketParticipant(ticketId, userId);

      if (success) {
        logger.info(`User ${userId} added to ticket ${ticketId}`);
      }

      return success;
    } catch (error) {
      logger.error("Failed to add user to ticket:", error);
      return false;
    }
  }

  /**
   * Remove user from ticket
   * @param {string} ticketId - Ticket ID
   * @param {string} userId - User ID to remove
   * @returns {Promise<boolean>} Success status
   */
  async removeUserFromTicket(ticketId, userId) {
    try {
      const ticket = await this.storage.getTicket(ticketId);
      if (!ticket) {
        throw new Error("Ticket not found");
      }

      const success = await this.storage.removeTicketParticipant(
        ticketId,
        userId,
      );

      if (success) {
        logger.info(`User ${userId} removed from ticket ${ticketId}`);
      }

      return success;
    } catch (error) {
      logger.error("Failed to remove user from ticket:", error);
      return false;
    }
  }

  /**
   * Get user's tickets
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @param {string} status - Status filter
   * @returns {Promise<Array>} Array of tickets
   */
  async getUserTickets(userId, guildId, status = "all") {
    try {
      return await this.storage.getTicketsByUser(userId, guildId, { status });
    } catch (error) {
      logger.error("Failed to get user tickets:", error);
      return [];
    }
  }

  /**
   * Get guild ticket statistics
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} Ticket statistics
   */
  async getGuildStats(guildId) {
    try {
      const stats = await this.storage.getTicketStats(guildId);
      const limitCheck = await this.checkTicketLimit(guildId);

      return {
        ...stats,
        limit: limitCheck.max,
        current: limitCheck.current,
        isPro: limitCheck.isPro,
      };
    } catch (error) {
      logger.error("Failed to get guild stats:", error);
      return {
        total: 0,
        open: 0,
        closed: 0,
        archived: 0,
        limit: 50,
        current: 0,
        isPro: false,
      };
    }
  }

  /**
   * Check if category limit is exceeded
   * @param {Array} categories - Categories to check
   * @param {string} guildId - Guild ID
   * @returns {Promise<{valid: boolean, max: number, isPro: boolean}>}
   */
  async checkCategoryLimit(categories, guildId) {
    try {
      const isPro = await this.premiumManager.isFeatureActive(
        guildId,
        "pro_engine",
      );
      const maxCategories = isPro
        ? PRO_ENGINE.MAX_CATEGORIES
        : FREE_TIER.MAX_CATEGORIES;

      return {
        valid: categories.length <= maxCategories,
        max: maxCategories,
        isPro,
      };
    } catch (error) {
      logger.error("Failed to check category limit:", error);
      return { valid: true, max: FREE_TIER.MAX_CATEGORIES, isPro: false };
    }
  }

  /**
   * Get ticket by ticket ID
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<Object|null>} Ticket or null
   */
  async getTicket(ticketId) {
    try {
      return await this.storage.getTicket(ticketId);
    } catch (error) {
      logger.error("Failed to get ticket:", error);
      return null;
    }
  }

  /**
   * Get ticket by channel ID
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object|null>} Ticket or null
   */
  async getTicketByChannel(channelId) {
    try {
      return await this.storage.getTicketByChannel(channelId);
    } catch (error) {
      logger.error("Failed to get ticket by channel:", error);
      return null;
    }
  }

  /**
   * Delete a ticket (permanent)
   * @param {string} ticketId - Ticket ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteTicket(ticketId) {
    try {
      // First delete transcript if exists
      const transcript =
        await this.storage.getTicketTranscriptByTicket(ticketId);
      if (transcript) {
        await this.storage.deleteTicketTranscript(transcript.transcriptId);
      }

      // Then delete ticket
      const success = await this.storage.deleteTicket(ticketId);

      if (success) {
        logger.info(`Ticket deleted: ${ticketId}`);
      }

      return success;
    } catch (error) {
      logger.error("Failed to delete ticket:", error);
      return false;
    }
  }

  /**
   * Get tickets for cleanup (expired)
   * @param {string} guildId - Guild ID
   * @param {number} days - Days of inactivity
   * @returns {Promise<Array>} Array of expired tickets
   */
  async getExpiredTickets(guildId, days = 7) {
    try {
      const isPro = await this.premiumManager.isFeatureActive(
        guildId,
        "pro_engine",
      );
      const inactiveDays = isPro
        ? PRO_ENGINE.TRANSCRIPT_RETENTION_DAYS
        : FREE_TIER.TRANSCRIPT_RETENTION_DAYS;

      // Use the smaller of the two (config or tier limit)
      const daysToUse = days > 0 ? Math.min(days, inactiveDays) : inactiveDays;

      return await this.storage.getExpiredTickets(guildId, daysToUse);
    } catch (error) {
      logger.error("Failed to get expired tickets:", error);
      return [];
    }
  }

  /**
   * Purge all ticket data and transcripts for a guild
   * @param {string} guildId - Guild ID
   * @returns {Promise<boolean>} Success status
   */
  async purgeGuildData(guildId) {
    try {
      // 1. Delete all tickets and transcripts
      await this.storage.purgeGuildTickets(guildId);

      // 2. Reset the ticket counter
      await this.storage.resetTicketCounter(guildId);

      logger.info(`Total Purge complete for guild ${guildId}`);
      return true;
    } catch (error) {
      logger.error("Failed to purge guild data:", error);
      return false;
    }
  }
}

// Singleton instance
let instance = null;

export function getTicketManager() {
  if (!instance) {
    instance = new TicketManager();
  }
  return instance;
}
