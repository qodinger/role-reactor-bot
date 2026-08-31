/**
 * Real-time AI Pricing Service
 * Fetches model pricing from OpenRouter API at startup
 * Caches pricing to avoid repeated API calls
 */

import { getLogger } from "../logger.js";

const logger = getLogger();

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_TTL_MS = parseInt(process.env.PRICE_CACHE_TTL_MS) || 3600000; // 1 hour default
const FETCH_TIMEOUT_MS = 10000; // 10 seconds

class PricingService {
  constructor() {
    this.modelPricing = new Map();
    this.lastFetchTime = 0;
    this.fetchPromise = null;
    this.initialized = false;
  }

  /**
   * Initialize pricing cache - called at startup
   * Fetches from OpenRouter API and caches results
   */
  async initialize() {
    if (this.initialized) return;
    if (this.fetchPromise) return this.fetchPromise;

    this.fetchPromise = this._fetchAndCache();
    await this.fetchPromise;
    this.initialized = true;
  }

  /**
   * Fetch pricing from OpenRouter API and cache it
   */
  async _fetchAndCache() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(OPENROUTER_MODELS_URL, {
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`OpenRouter API returned ${response.status}`);
      }

      const data = await response.json();
      const models = data.data || data.models || [];

      for (const model of models) {
        if (model.id && model.pricing) {
          const promptCost = parseFloat(model.pricing.prompt) || 0;
          const completionCost = parseFloat(model.pricing.completion) || 0;

          this.modelPricing.set(model.id, {
            prompt: promptCost,
            completion: completionCost,
            image: parseFloat(model.pricing.image) || 0,
            webSearch: parseFloat(model.pricing.web_search) || 0,
          });
        }
      }

      this.lastFetchTime = Date.now();
      logger.info(
        `[PricingService] Cached pricing for ${this.modelPricing.size} models from OpenRouter`,
      );
    } catch (error) {
      logger.warn(
        `[PricingService] Failed to fetch OpenRouter pricing: ${error.message}. Using cached data.`,
      );
    }
  }

  /**
   * Refresh pricing if cache is stale
   */
  async refreshIfNeeded() {
    if (Date.now() - this.lastFetchTime > CACHE_TTL_MS) {
      await this._fetchAndCache();
    }
  }

  /**
   * Get USD cost per token for a specific model
   * @param {string} modelId - Model ID (e.g., "deepseek/deepseek-chat")
   * @returns {{ prompt: number, completion: number } | null}
   */
  getModelPricing(modelId) {
    return this.modelPricing.get(modelId) || null;
  }

  /**
   * Calculate USD cost for a given usage
   * @param {string} modelId - Model ID
   * @param {number} promptTokens - Number of prompt tokens
   * @param {number} completionTokens - Number of completion tokens
   * @returns {number} Cost in USD
   */
  calculateCostUSD(modelId, promptTokens, completionTokens) {
    const pricing = this.modelPricing.get(modelId);
    if (!pricing) return null;

    return (
      pricing.prompt * promptTokens + pricing.completion * completionTokens
    );
  }

  /**
   * Calculate Core credits for a given USD cost
   * @param {number} costUSD - Cost in USD
   * @returns {number} Core credits to charge
   */
  calculateCoreCredits(costUSD) {
    const conversionRate = parseFloat(process.env.PRICE_CONVERSION_RATE) || 15;
    const markup = parseFloat(process.env.PRICE_PLATFORM_MARKUP) || 1.25;
    const minimumCharge = parseFloat(process.env.PRICE_MINIMUM_CHARGE) || 0.05;

    if (!costUSD || costUSD <= 0) return minimumCharge;

    const credits = costUSD * conversionRate * markup;
    return Math.max(credits, minimumCharge);
  }

  /**
   * Get fallback cost per token for providers without real-time pricing
   * @param {string} provider - Provider name
   * @returns {number} Estimated cost per token in USD
   */
  getFallbackCostPerToken(provider) {
    const fallbacks = {
      stability:
        parseFloat(process.env.PRICE_STABILITY_COST_PER_TOKEN) || 0.00002,
      runpod: parseFloat(process.env.PRICE_RUNPOD_COST_PER_REQUEST) || 0.01,
      civitai: parseFloat(process.env.PRICE_CIVITAI_COST_PER_IMAGE) || 0.006,
    };
    return fallbacks[provider] || fallbacks.stability;
  }

  /**
   * Get all loaded model IDs (for debugging)
   * @returns {string[]}
   */
  getLoadedModels() {
    return Array.from(this.modelPricing.keys());
  }

  /**
   * Check if pricing is loaded
   * @returns {boolean}
   */
  isLoaded() {
    return this.modelPricing.size > 0;
  }
}

export const pricingService = new PricingService();
export default pricingService;
