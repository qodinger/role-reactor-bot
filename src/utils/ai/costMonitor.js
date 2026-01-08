import { getLogger } from "../logger.js";
import { getStorageManager } from "../storage/storageManager.js";

const logger = getLogger();

/**
 * AI Cost Monitor
 * Tracks OpenRouter API costs and alerts on significant changes
 */
export class AICostMonitor {
  constructor() {
    this.storageKey = "ai_cost_history";
    this.alertThreshold = 0.2; // Alert on 20% cost change
    this.minMarkup = 10; // Minimum 10x markup for safety
  }

  /**
   * Record current AI cost from API response
   * @param {Object} result - AI API result with cost information
   * @param {string} provider - Provider name (openrouter, stability, etc.)
   * @returns {Promise<void>}
   */
  async recordCost(result, provider = "openrouter") {
    // Check if we have cost data
    if (!result?.openRouterCost || !result?.openRouterTokens) {
      // Log when cost data is missing (should be rare with OpenRouter)
      logger.debug(
        `No cost data available for ${provider} request - skipping cost recording`,
      );
      return;
    }

    try {
      const storage = await getStorageManager();
      const costHistory = (await storage.get(this.storageKey)) || {};

      const today = new Date().toISOString().split("T")[0];
      const costPerRequest = result.openRouterCost;
      const tokensUsed = result.openRouterTokens.total;

      // Validate cost data
      if (costPerRequest <= 0 || tokensUsed <= 0) {
        logger.warn(
          `Invalid cost data for ${provider}: cost=${costPerRequest}, tokens=${tokensUsed}`,
        );
        return;
      }

      // Initialize provider history if not exists
      if (!costHistory[provider]) {
        costHistory[provider] = {
          dailyAverages: {},
          lastAlert: null,
          trends: [],
        };
      }

      const providerHistory = costHistory[provider];

      // Update daily average
      if (!providerHistory.dailyAverages[today]) {
        providerHistory.dailyAverages[today] = {
          totalCost: 0,
          totalRequests: 0,
          totalTokens: 0,
          averageCostPerRequest: 0,
          averageCostPerToken: 0,
        };
      }

      const dailyData = providerHistory.dailyAverages[today];
      dailyData.totalCost += costPerRequest;
      dailyData.totalRequests += 1;
      dailyData.totalTokens += tokensUsed;
      dailyData.averageCostPerRequest =
        dailyData.totalCost / dailyData.totalRequests;
      dailyData.averageCostPerToken =
        dailyData.totalCost / dailyData.totalTokens;

      // Check for significant cost changes
      await this.checkForCostChanges(
        provider,
        dailyData.averageCostPerRequest,
        providerHistory,
      );

      // Clean up old data (keep last 30 days)
      this.cleanupOldData(providerHistory.dailyAverages);

      // Save updated history
      costHistory[provider] = providerHistory;
      await storage.set(this.storageKey, costHistory);

      logger.debug(
        `Recorded AI cost: ${provider} - $${costPerRequest.toFixed(8)} per request`,
      );
    } catch (error) {
      logger.error("Failed to record AI cost:", error);
    }
  }

  /**
   * Check for significant cost changes and alert if needed
   * @param {string} provider - Provider name
   * @param {number} currentCost - Current cost per request
   * @param {Object} providerHistory - Provider cost history
   * @returns {Promise<void>}
   */
  async checkForCostChanges(provider, currentCost, providerHistory) {
    const dailyAverages = Object.values(providerHistory.dailyAverages);
    if (dailyAverages.length < 2) {
      return; // Need at least 2 days of data
    }

    // Get yesterday's average
    const sortedDays = Object.keys(providerHistory.dailyAverages).sort();
    const yesterday = sortedDays[sortedDays.length - 2];
    const yesterdayCost =
      providerHistory.dailyAverages[yesterday]?.averageCostPerRequest;

    if (!yesterdayCost) return;

    const changePercent = Math.abs(
      (currentCost - yesterdayCost) / yesterdayCost,
    );

    if (changePercent >= this.alertThreshold) {
      const changeDirection =
        currentCost > yesterdayCost ? "increased" : "decreased";
      const changeAmount = (changePercent * 100).toFixed(1);

      logger.warn(
        `🚨 AI Cost Alert: ${provider} costs ${changeDirection} by ${changeAmount}%`,
      );
      logger.warn(
        `Previous: $${yesterdayCost.toFixed(8)}, Current: $${currentCost.toFixed(8)}`,
      );

      // Check if our markup is still safe
      await this.checkMarkupSafety(provider, currentCost);

      // Record alert
      providerHistory.lastAlert = {
        date: new Date().toISOString(),
        changePercent: changePercent * 100,
        changeDirection,
        previousCost: yesterdayCost,
        currentCost,
      };
    }
  }

  /**
   * Check if current markup is still safe given new costs
   * @param {string} provider - Provider name
   * @param {number} currentCost - Current cost per request
   * @returns {Promise<void>}
   */
  async checkMarkupSafety(provider, currentCost) {
    // Use dynamic pricing minimum charge instead of legacy config
    const { getPricingConfig } = await import("../dynamicPricing.js");
    const pricingConfig = getPricingConfig();
    const minCoreCharge = pricingConfig.minimumCharge; // 0.01 Core minimum

    const currentMarkup = minCoreCharge / currentCost;

    if (currentMarkup < this.minMarkup) {
      logger.error(`🚨 CRITICAL: ${provider} markup below minimum safe level!`);
      logger.error(
        `Current markup: ${currentMarkup.toFixed(1)}x (minimum: ${this.minMarkup}x)`,
      );
      logger.error(
        `Consider increasing minimum Core charge to ${(currentCost * this.minMarkup).toFixed(6)} or switching providers`,
      );
    } else if (currentMarkup < 25) {
      logger.warn(
        `⚠️  WARNING: ${provider} markup getting low: ${currentMarkup.toFixed(1)}x`,
      );
      logger.warn(`Consider monitoring closely or adjusting pricing`);
    } else {
      logger.info(
        `✅ ${provider} markup still safe: ${currentMarkup.toFixed(1)}x`,
      );
    }
  }

  /**
   * Get estimated cost when real cost data is unavailable
   * @param {string} provider - Provider name
   * @param {number} tokens - Number of tokens used
   * @returns {Promise<number>} Estimated cost per request
   */
  async getEstimatedCost(provider = "openrouter", tokens = 50) {
    try {
      const stats = await this.getCostStats(provider);

      if (stats && stats.currentCostPerToken > 0) {
        // Use current average cost per token
        return stats.currentCostPerToken * tokens;
      }

      // Fallback to known averages (based on our testing)
      const fallbackCosts = {
        openrouter: 0.00003045, // From our test data
        stability: 0.001, // Estimated Stability AI cost
      };

      return fallbackCosts[provider] || fallbackCosts.openrouter;
    } catch (error) {
      logger.error("Failed to get estimated cost:", error);
      return 0.00003045; // Safe fallback
    }
  }

  /**
   * Record estimated cost when real data is unavailable
   * @param {string} provider - Provider name
   * @param {number} tokens - Number of tokens used
   * @returns {Promise<void>}
   */
  async recordEstimatedCost(provider = "openrouter", tokens = 50) {
    const estimatedCost = await this.getEstimatedCost(provider, tokens);

    logger.info(
      `Recording estimated cost for ${provider}: $${estimatedCost.toFixed(8)} (${tokens} tokens)`,
    );

    // Create a mock result object for recording
    const mockResult = {
      openRouterCost: estimatedCost,
      openRouterTokens: {
        total: tokens,
        prompt: Math.floor(tokens * 0.6), // Estimate 60% prompt, 40% completion
        completion: Math.floor(tokens * 0.4),
        cached: 0,
        reasoning: 0,
      },
    };

    await this.recordCost(mockResult, provider);
  }

  /**
   * Get cost statistics for a provider
   * @param {string} provider - Provider name
   * @returns {Promise<Object>} Cost statistics
   */
  async getCostStats(provider = "openrouter") {
    try {
      const storage = await getStorageManager();
      const costHistory = (await storage.get(this.storageKey)) || {};

      if (!costHistory[provider]) {
        return null;
      }

      const providerHistory = costHistory[provider];
      const dailyAverages = Object.entries(providerHistory.dailyAverages).sort(
        ([a], [b]) => a.localeCompare(b),
      );

      if (dailyAverages.length === 0) {
        return null;
      }

      const latest = dailyAverages[dailyAverages.length - 1][1];
      const oldest = dailyAverages[0][1];

      // Calculate trend
      const costTrend =
        dailyAverages.length > 1
          ? ((latest.averageCostPerRequest - oldest.averageCostPerRequest) /
              oldest.averageCostPerRequest) *
            100
          : 0;

      return {
        provider,
        currentCostPerRequest: latest.averageCostPerRequest,
        currentCostPerToken: latest.averageCostPerToken,
        totalRequests: Object.values(providerHistory.dailyAverages).reduce(
          (sum, day) => sum + day.totalRequests,
          0,
        ),
        totalCost: Object.values(providerHistory.dailyAverages).reduce(
          (sum, day) => sum + day.totalCost,
          0,
        ),
        daysTracked: dailyAverages.length,
        costTrend: `${costTrend.toFixed(2)}%`,
        lastAlert: providerHistory.lastAlert,
        dailyHistory: dailyAverages.slice(-7), // Last 7 days
      };
    } catch (error) {
      logger.error("Failed to get cost stats:", error);
      return null;
    }
  }

  /**
   * Clean up old cost data (keep last 30 days)
   * @param {Object} dailyAverages - Daily averages object
   */
  cleanupOldData(dailyAverages) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split("T")[0];

    Object.keys(dailyAverages).forEach(date => {
      if (date < cutoffDate) {
        delete dailyAverages[date];
      }
    });
  }
}

// Export singleton instance
export const aiCostMonitor = new AICostMonitor();
