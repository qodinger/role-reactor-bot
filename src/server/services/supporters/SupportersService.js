/**
 * Supporters Service
 * Provides API endpoints for supporter leaderboard and statistics
 */

import { BaseService } from "../BaseService.js";
import { apiRateLimiter } from "../../middleware/rateLimiter.js";
import { validateQuery } from "../../middleware/validation.js";
import { paginate } from "../../utils/pagination.js";
import { getLogger } from "../../../utils/logger.js";
import { serverConfig } from "../../config/serverConfig.js";

const logger = getLogger();
const API_PREFIX = serverConfig.metadata.apiPrefix;

export class SupportersService extends BaseService {
  constructor() {
    super({
      name: "supporters",
      version: "v1",
      basePath: `${API_PREFIX}/supporters`,
      metadata: {
        description: "Supporter leaderboard and statistics API",
        version: "1.0.0",
      },
    });

    this.setupRoutes();
  }

  setupRoutes() {
    // Apply rate limiting to all routes
    this.use(apiRateLimiter);

    // GET /api/supporters/leaderboard - Get supporter leaderboard
    this.get(
      "/leaderboard",
      validateQuery({
        properties: {
          limit: { type: "number", min: 1, max: 100 },
          offset: { type: "number", min: 0 },
          page: { type: "number", min: 1 },
        },
      }),
      this.asyncHandler(this.handleLeaderboard.bind(this)),
    );
  }

  async handleLeaderboard(req, res) {
    const { getStorageManager } = await import(
      "../../../utils/storage/storageManager.js"
    );
    const storage = await getStorageManager();
    const coreCredits = (await storage.get("core_credit")) || {};

    // Aggregate supporter data
    const supporters = [];
    let totalRaised = 0;

    for (const [userId, userData] of Object.entries(coreCredits)) {
      const payments = userData.cryptoPayments || [];

      if (payments.length === 0) continue;

      // Calculate totals
      const totalDonated = payments.reduce(
        (sum, p) => sum + (p.amount || 0),
        0,
      );
      const totalCores = payments.reduce((sum, p) => sum + (p.cores || 0), 0);
      const paymentCount = payments.length;

      if (totalDonated > 0) {
        supporters.push({
          userId,
          username: userData.username || null,
          totalDonated,
          totalCores,
          paymentCount,
        });
        totalRaised += totalDonated;
      }
    }

    // Sort by total donated (descending)
    supporters.sort((a, b) => b.totalDonated - a.totalDonated);

    // Add rank
    supporters.forEach((supporter, index) => {
      supporter.rank = index + 1;
    });

    // Handle pagination
    const { limit, offset, page } = req.query;
    let paginatedSupporters = supporters;
    let paginationInfo = null;

    if (page) {
      // Page-based pagination
      const pageLimit = limit || 20;
      const result = paginate(supporters, page, pageLimit);
      paginatedSupporters = result.items;
      paginationInfo = result.pagination;
    } else if (limit || offset) {
      // Offset-based pagination
      const start = offset || 0;
      const end = limit ? start + limit : undefined;
      paginatedSupporters = supporters.slice(start, end);
      paginationInfo = {
        offset: start,
        limit: limit || supporters.length,
        total: supporters.length,
      };
    }

    logger.info(
      `📊 Supporter leaderboard: ${supporters.length} supporters, $${totalRaised.toFixed(2)} total raised`,
      {
        requestId: req.requestId,
        paginated: !!paginationInfo,
      },
    );

    this.sendSuccess(res, {
      supporters: paginatedSupporters,
      totalSupporters: supporters.length,
      totalRaised,
      ...(paginationInfo && { pagination: paginationInfo }),
    });
  }

  /**
   * Get service health status
   * Includes storage connectivity check
   */
  async getHealthStatus() {
    const baseStatus = await super.getHealthStatus();

    try {
      // Check storage connectivity
      const { getStorageManager } = await import(
        "../../../utils/storage/storageManager.js"
      );
      const storage = await getStorageManager();
      await storage.get("core_credit"); // Test read access

      return {
        ...baseStatus,
        checks: {
          storage: { status: "healthy", message: "Storage accessible" },
        },
      };
    } catch (error) {
      return {
        ...baseStatus,
        status: "degraded",
        checks: {
          storage: {
            status: "unhealthy",
            message: "Storage check failed",
            error: error.message,
          },
        },
      };
    }
  }
}

// Export service config for auto-loading (optional)
export const serviceConfig = {
  name: "supporters",
  version: "v1",
  basePath: "/api/v1/supporters",
  loader: () => {
    const service = new SupportersService();
    return service;
  },
  metadata: {
    description: "Supporter leaderboard and statistics API",
    version: "1.0.0",
  },
};
