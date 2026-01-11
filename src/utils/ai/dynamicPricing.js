/**
 * Dynamic AI Pricing System
 * Charges users based on actual OpenRouter API costs with configurable markup
 * UPDATED: Separate pricing for images to ensure better profit margins
 */

import { getLogger } from "../logger.js";
import { aiUsageMonitor } from "./costMonitor.js";

const logger = getLogger();

// Price calculation cache for performance optimization
const priceCache = new Map();
const CACHE_SIZE_LIMIT = 1000;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Dynamic Pricing Configuration
 */
const PRICING_CONFIG = {
  // Markup multipliers for different cost ranges
  markupTiers: [
    // Order matters - checked from lowest to highest threshold
    { name: "veryLow", threshold: 0.00005, markup: 200 }, // Up to $0.00005 - 200x markup
    { name: "low", threshold: 0.0001, markup: 150 }, // Up to $0.0001 - 150x markup
    { name: "medium", threshold: 0.0005, markup: 100 }, // Up to $0.0005 - 100x markup
    { name: "high", threshold: 0.001, markup: 75 }, // Up to $0.001 - 75x markup
    { name: "veryHigh", threshold: 999999, markup: 50 }, // Above $0.001 - 50x markup
  ],

  // Minimum and maximum charges for CHAT (keep existing good margins)
  minimumCharge: 0.01, // Minimum 0.01 Core (for chat)
  maximumCharge: 0.05, // Maximum 0.05 Core (for chat)

  // Image-specific pricing for better profit margins
  imagePricing: {
    minimumCharge: 0.05, // Higher minimum for images (better base profit)
    maximumCharge: null, // NO MAXIMUM - charge based on actual usage
    markupTiers: [
      // Same markup tiers but with no upper limit
      { name: "veryLow", threshold: 0.00005, markup: 200 },
      { name: "low", threshold: 0.0001, markup: 150 },
      { name: "medium", threshold: 0.0005, markup: 100 },
      { name: "high", threshold: 0.001, markup: 75 },
      { name: "veryHigh", threshold: 999999, markup: 50 }, // Use large number instead of Infinity
    ],
  },

  // Fallback pricing when real cost data is unavailable
  fallbackPricing: {
    chat: 0.01, // Keep chat pricing low
    image: 0.1, // Higher fallback for images
  },

  // Rounding precision for user-friendly pricing
  roundingPrecision: 2, // Round to 2 decimal places (0.01 Core minimum)
};

/**
 * Calculate dynamic Core price based on real API cost
 * UPDATED: Uses separate pricing for images vs chat
 * @param {number} realCostUSD - Real cost in USD from API
 * @param {string} requestType - Type of request ('chat', 'image', etc.)
 * @returns {number} Core credits to charge
 */
export function calculateDynamicPrice(realCostUSD, requestType = "chat") {
  try {
    // Handle invalid or missing cost data
    if (!realCostUSD || realCostUSD <= 0) {
      logger.warn(
        `Invalid real cost data: ${realCostUSD}, using fallback pricing`,
      );
      return (
        PRICING_CONFIG.fallbackPricing[requestType] ||
        PRICING_CONFIG.fallbackPricing.chat
      );
    }

    // Check cache for performance optimization
    const cacheKey = `${realCostUSD.toFixed(8)}_${requestType}`;
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.price;
    }

    // Use image-specific pricing for image generation
    const isImage = requestType === "image";
    const pricingConfig = isImage
      ? PRICING_CONFIG.imagePricing
      : PRICING_CONFIG;
    const markupTiers = pricingConfig.markupTiers || PRICING_CONFIG.markupTiers;

    // Determine markup tier based on cost
    let markup = markupTiers[markupTiers.length - 1].markup; // Default to lowest markup

    for (const tier of markupTiers) {
      if (realCostUSD <= tier.threshold) {
        markup = tier.markup;
        logger.debug(
          `Cost ${realCostUSD} falls in ${tier.name} tier (${markup}x markup) for ${requestType}`,
        );
        break;
      }
    }

    // Calculate dynamic price
    let dynamicPrice = realCostUSD * markup;

    // Apply minimum charge only if calculated price is below minimum
    const minCharge =
      pricingConfig.minimumCharge || PRICING_CONFIG.minimumCharge;
    const maxCharge =
      pricingConfig.maximumCharge !== undefined
        ? pricingConfig.maximumCharge
        : PRICING_CONFIG.maximumCharge;

    // Apply minimum charge (ensures base profitability)
    dynamicPrice = Math.max(dynamicPrice, minCharge);

    // Only apply maximum if it exists (images have no maximum)
    if (maxCharge !== null && maxCharge !== undefined) {
      dynamicPrice = Math.min(dynamicPrice, maxCharge);
    }

    // Round to user-friendly precision
    dynamicPrice =
      Math.round(
        dynamicPrice * Math.pow(10, PRICING_CONFIG.roundingPrecision),
      ) / Math.pow(10, PRICING_CONFIG.roundingPrecision);

    // Cache the result
    if (priceCache.size >= CACHE_SIZE_LIMIT) {
      // Clear oldest entries when cache is full
      const oldestKey = priceCache.keys().next().value;
      priceCache.delete(oldestKey);
    }
    priceCache.set(cacheKey, { price: dynamicPrice, timestamp: Date.now() });

    logger.info(
      `Dynamic pricing: Real cost ${realCostUSD} → ${dynamicPrice} Core (${markup}x markup) for ${requestType}`,
    );

    return dynamicPrice;
  } catch (error) {
    logger.error("Error calculating dynamic price:", error);
    return (
      PRICING_CONFIG.fallbackPricing[requestType] ||
      PRICING_CONFIG.fallbackPricing.chat
    );
  }
}

/**
 * Get pricing explanation for user display
 * @param {number} realCostUSD - Real cost in USD
 * @param {number} corePrice - Calculated Core price
 * @returns {Object} Pricing breakdown for user
 */
export function getPricingExplanation(realCostUSD, corePrice) {
  const markup = realCostUSD > 0 ? Math.round(corePrice / realCostUSD) : 0;

  return {
    realCost: realCostUSD,
    corePrice,
    markup: `${markup}x`,
    explanation: `Based on actual API cost of ${realCostUSD.toFixed(8)}`,
  };
}

/**
 * Estimate price before making API call (for user preview)
 * Uses historical average costs from cost monitor
 * @param {string} provider - AI provider name
 * @param {number} estimatedTokens - Estimated tokens for request
 * @returns {Promise<number>} Estimated Core price
 */
export async function estimatePrice(
  provider = "openrouter",
  estimatedTokens = 50,
) {
  try {
    // Get historical usage data
    const costStats = await aiUsageMonitor.getCostStats(provider);

    let estimatedCost;
    if (costStats && costStats.currentCostPerToken > 0) {
      // Use real historical data
      estimatedCost = costStats.currentCostPerToken * estimatedTokens;
    } else {
      // Use fallback estimation
      estimatedCost = await aiUsageMonitor.getEstimatedCost(
        provider,
        estimatedTokens,
      );
    }

    return calculateDynamicPrice(estimatedCost, "chat");
  } catch (error) {
    logger.error("Error estimating price:", error);
    return PRICING_CONFIG.fallbackPricing.chat;
  }
}

/**
 * Calculate price based on token usage (when cost data unavailable)
 * @param {Object} usage - Token usage from API response
 * @param {string} provider - AI provider name
 * @returns {Promise<number>} Calculated Core price
 */
export async function calculatePriceFromTokens(usage, provider = "openrouter") {
  try {
    const totalTokens =
      usage?.total_tokens ||
      usage?.prompt_tokens + usage?.completion_tokens ||
      50;

    // Get average usage per token from historical data
    const costStats = await aiUsageMonitor.getCostStats(provider);
    let costPerToken;

    if (costStats && costStats.currentCostPerToken > 0) {
      costPerToken = costStats.currentCostPerToken;
    } else {
      // Fallback to known averages
      const fallbackRates = {
        openrouter: 0.0000006, // Average usage per token
        stability: 0.00002, // Stability AI average
      };
      costPerToken = fallbackRates[provider] || fallbackRates.openrouter;
    }

    const estimatedCost = costPerToken * totalTokens;
    return calculateDynamicPrice(estimatedCost, "chat");
  } catch (error) {
    logger.error("Error calculating price from tokens:", error);
    return PRICING_CONFIG.fallbackPricing.chat;
  }
}

/**
 * Update pricing configuration (for admin adjustments)
 * @param {Object} newConfig - New pricing configuration
 * @returns {boolean} Success status
 */
export function updatePricingConfig(newConfig) {
  try {
    // Validate new configuration
    if (newConfig.markupTiers) {
      // Validate markup tiers structure
      if (!Array.isArray(newConfig.markupTiers)) {
        throw new Error("markupTiers must be an array");
      }

      for (const tier of newConfig.markupTiers) {
        if (!tier.name || !tier.threshold || !tier.markup) {
          throw new Error("Each tier must have name, threshold, and markup");
        }
        if (tier.markup <= 0) {
          throw new Error("Markup must be positive");
        }
      }

      PRICING_CONFIG.markupTiers = newConfig.markupTiers;
    }

    if (newConfig.minimumCharge !== undefined) {
      if (newConfig.minimumCharge < 0) {
        throw new Error("minimumCharge must be non-negative");
      }
      PRICING_CONFIG.minimumCharge = newConfig.minimumCharge;
    }

    if (newConfig.maximumCharge !== undefined) {
      if (newConfig.maximumCharge < PRICING_CONFIG.minimumCharge) {
        throw new Error("maximumCharge must be >= minimumCharge");
      }
      PRICING_CONFIG.maximumCharge = newConfig.maximumCharge;
    }

    logger.info("Pricing configuration updated:", newConfig);
    return true;
  } catch (error) {
    logger.error("Error updating pricing config:", error);
    return false;
  }
}

/**
 * Get current pricing configuration
 * @returns {Object} Current pricing configuration
 */
export function getPricingConfig() {
  return { ...PRICING_CONFIG };
}

/**
 * Analyze pricing for a range of costs (useful for admin analysis)
 * @param {number} minCost - Minimum cost to analyze
 * @param {number} maxCost - Maximum cost to analyze
 * @param {number} steps - Number of steps to analyze
 * @returns {Array} Array of cost analysis objects
 */
export function analyzePricingRange(
  minCost = 0.0001,
  maxCost = 0.01,
  steps = 10,
) {
  const results = [];
  const stepSize = (maxCost - minCost) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    const cost = minCost + stepSize * i;
    const corePrice = calculateDynamicPrice(cost, "chat");
    const markup = cost > 0 ? Math.round(corePrice / cost) : 0;

    results.push({
      apiCost: cost,
      corePrice,
      markup: `${markup}x`,
      profitMargin:
        cost > 0
          ? `${(((corePrice - cost) / corePrice) * 100).toFixed(1)}%`
          : "N/A",
    });
  }

  return results;
}

export default {
  calculateDynamicPrice,
  getPricingExplanation,
  estimatePrice,
  calculatePriceFromTokens,
  updatePricingConfig,
  getPricingConfig,
  analyzePricingRange,
};
