import { BaseRepository } from "./BaseRepository.js";

/**
 * Repository for managing payment transactions
 * Stores all PayPal, crypto, and other payment records
 */
export class PaymentRepository extends BaseRepository {
  constructor(db, cache, logger) {
    super(db, "payments", cache, logger);
    this._ensureIndexes();
  }

  /**
   * Create indexes for optimal query performance
   */
  async _ensureIndexes() {
    try {
      await this.collection.createIndex({ paymentId: 1 }, { unique: true });
      await this.collection.createIndex({ discordId: 1 });
      await this.collection.createIndex({ provider: 1 });
      await this.collection.createIndex({ status: 1 });
      await this.collection.createIndex({ createdAt: -1 });
      await this.collection.createIndex({ discordId: 1, createdAt: -1 }); // Compound for user history
      this.logger.debug("PaymentRepository indexes ensured");
    } catch (error) {
      this.logger.debug(
        "PaymentRepository indexes already exist or error:",
        error.message,
      );
    }
  }

  /**
   * Create a new payment record
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object|null>} Created payment or null
   */
  async create(paymentData) {
    try {
      const now = new Date().toISOString();
      const payment = {
        paymentId: paymentData.paymentId, // External ID from PayPal/Crypto
        discordId: paymentData.discordId,
        provider: paymentData.provider, // "paypal", "coinbase", "stripe", etc.
        type: paymentData.type || "one_time", // "one_time", "subscription", "refund"
        status: paymentData.status || "completed", // "pending", "completed", "failed", "refunded"
        amount: paymentData.amount,
        currency: paymentData.currency || "USD",
        coresGranted: paymentData.coresGranted || 0,
        tier: paymentData.tier || null,
        email: paymentData.email?.toLowerCase().trim() || null,
        metadata: paymentData.metadata || {},
        createdAt: now,
        updatedAt: now,
        processedAt: paymentData.status === "completed" ? now : null,
      };

      const result = await this.collection.insertOne(payment);

      if (result.acknowledged) {
        payment._id = result.insertedId;
        this.logger.info(
          `Payment created: ${payment.paymentId} for user ${payment.discordId}`,
        );
        return payment;
      }
      return null;
    } catch (error) {
      // Handle duplicate payment ID
      if (error.code === 11000) {
        this.logger.warn(
          `Duplicate payment detected: ${paymentData.paymentId}`,
        );
        return await this.findByPaymentId(paymentData.paymentId);
      }
      this.logger.error("Failed to create payment", error);
      return null;
    }
  }

  /**
   * Find payment by external payment ID
   * @param {string} paymentId - External payment ID
   * @returns {Promise<Object|null>} Payment document or null
   */
  async findByPaymentId(paymentId) {
    try {
      return await this.collection.findOne({ paymentId });
    } catch (error) {
      this.logger.error(`Failed to find payment ${paymentId}`, error);
      return null;
    }
  }

  /**
   * Check if payment has been processed
   * @param {string} paymentId - External payment ID
   * @returns {Promise<boolean>} Whether payment exists and is completed
   */
  async isProcessed(paymentId) {
    try {
      const payment = await this.collection.findOne(
        { paymentId, status: "completed" },
        { projection: { _id: 1 } },
      );
      return !!payment;
    } catch (error) {
      this.logger.error(`Failed to check payment status ${paymentId}`, error);
      return false;
    }
  }

  /**
   * Get all payments for a user
   * @param {string} discordId - Discord user ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of payment documents
   */
  async findByDiscordId(discordId, options = {}) {
    try {
      const { limit = 50, skip = 0, status = null, provider = null } = options;

      const query = { discordId };
      if (status) query.status = status;
      if (provider) query.provider = provider;

      return await this.collection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    } catch (error) {
      this.logger.error(`Failed to find payments for user ${discordId}`, error);
      return [];
    }
  }

  /**
   * Get payment statistics for a user
   * @param {string} discordId - Discord user ID
   * @returns {Promise<Object>} Payment statistics
   */
  async getUserStats(discordId) {
    try {
      const pipeline = [
        { $match: { discordId, status: "completed" } },
        {
          $group: {
            _id: "$provider",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
            totalCores: { $sum: "$coresGranted" },
          },
        },
      ];

      const results = await this.collection.aggregate(pipeline).toArray();

      const stats = {
        totalPayments: 0,
        totalAmount: 0,
        totalCores: 0,
        byProvider: {},
      };

      for (const result of results) {
        stats.totalPayments += result.count;
        stats.totalAmount += result.totalAmount;
        stats.totalCores += result.totalCores;
        stats.byProvider[result._id] = {
          count: result.count,
          amount: result.totalAmount,
          cores: result.totalCores,
        };
      }

      return stats;
    } catch (error) {
      this.logger.error(
        `Failed to get payment stats for user ${discordId}`,
        error,
      );
      return {
        totalPayments: 0,
        totalAmount: 0,
        totalCores: 0,
        byProvider: {},
      };
    }
  }

  /**
   * Update payment status
   * @param {string} paymentId - External payment ID
   * @param {string} status - New status
   * @param {Object} additionalData - Additional data to update
   * @returns {Promise<boolean>} Success status
   */
  async updateStatus(paymentId, status, additionalData = {}) {
    try {
      const updateData = {
        status,
        updatedAt: new Date().toISOString(),
        ...additionalData,
      };

      if (status === "completed") {
        updateData.processedAt = new Date().toISOString();
      }

      const result = await this.collection.updateOne(
        { paymentId },
        { $set: updateData },
      );

      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to update payment status ${paymentId}`, error);
      return false;
    }
  }

  /**
   * Get pending payments (for manual processing)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of pending payments
   */
  async getPending(options = {}) {
    try {
      const { limit = 100, provider = null } = options;

      const query = { status: "pending" };
      if (provider) query.provider = provider;

      return await this.collection
        .find(query)
        .sort({ createdAt: 1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      this.logger.error("Failed to get pending payments", error);
      return [];
    }
  }

  /**
   * Get payments requiring Discord ID (for manual matching)
   * @returns {Promise<Array>} Array of payments without Discord ID
   */
  async getPaymentsWithoutDiscordId() {
    try {
      return await this.collection
        .find({ discordId: null, status: "completed" })
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();
    } catch (error) {
      this.logger.error("Failed to get payments without Discord ID", error);
      return [];
    }
  }

  /**
   * Link payment to Discord user (for manual matching)
   * @param {string} paymentId - External payment ID
   * @param {string} discordId - Discord user ID
   * @returns {Promise<boolean>} Success status
   */
  async linkToDiscordUser(paymentId, discordId) {
    try {
      const result = await this.collection.updateOne(
        { paymentId },
        {
          $set: {
            discordId,
            updatedAt: new Date().toISOString(),
            linkedManually: true,
          },
        },
      );

      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(
        `Failed to link payment ${paymentId} to user ${discordId}`,
        error,
      );
      return false;
    }
  }

  /**
   * Get global payment statistics
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Global payment statistics
   */
  async getGlobalStats(options = {}) {
    try {
      const { startDate = null, endDate = null } = options;

      const matchStage = { status: "completed" };
      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = startDate;
        if (endDate) matchStage.createdAt.$lte = endDate;
      }

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalPayments: { $sum: 1 },
            totalRevenue: { $sum: "$amount" },
            totalCores: { $sum: "$coresGranted" },
            uniqueUsers: { $addToSet: "$discordId" },
          },
        },
        {
          $project: {
            _id: 0,
            totalPayments: 1,
            totalRevenue: 1,
            totalCores: 1,
            uniqueUsers: { $size: "$uniqueUsers" },
          },
        },
      ];

      const results = await this.collection.aggregate(pipeline).toArray();

      return (
        results[0] || {
          totalPayments: 0,
          totalRevenue: 0,
          totalCores: 0,
          uniqueUsers: 0,
        }
      );
    } catch (error) {
      this.logger.error("Failed to get global payment stats", error);
      return {
        totalPayments: 0,
        totalRevenue: 0,
        totalCores: 0,
        uniqueUsers: 0,
      };
    }
  }

  /**
   * Get recent payments
   * @param {number} limit - Maximum payments to return
   * @returns {Promise<Array>} Array of recent payments
   */
  async getRecent(limit = 10) {
    try {
      return await this.collection
        .find({ status: "completed" })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
    } catch (error) {
      this.logger.error("Failed to get recent payments", error);
      return [];
    }
  }
}
