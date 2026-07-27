import { getLogger } from "../logger.js";
import { config } from "../../config/config.js";

const logger = getLogger();

/**
 * Buy Me a Coffee API Client
 * Handles fetching supporters, subscriptions, and extras from BMAC API
 * API docs: https://developers.buymeacoffee.com/
 */
export class BMACClient {
  constructor() {
    this.apiToken = config.payments.buymeacoffeeApiToken;
    this.baseUrl = "https://developers.buymeacoffee.com/api/v1";
  }

  get enabled() {
    return !!this.apiToken;
  }

  /**
   * Make authenticated API request
   * @param {string} endpoint - API endpoint path
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Parsed JSON response
   */
  async request(endpoint, options = {}) {
    if (!this.enabled) {
      throw new Error("BMAC API token is not configured");
    }

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (response.status === 401) {
      throw new Error("BMAC API token expired or invalid — regenerate at https://developers.buymeacoffee.com");
    }

    if (response.status === 429) {
      throw new Error("BMAC API rate limited — retry later");
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`BMAC API error ${response.status}: ${text}`);
    }

    return response.json();
  }

  /**
   * Get paginated supporters
   * @param {Object} params
   * @param {number} [params.page=1] - Page number
   * @returns {Promise<Object>} Paginated supporter list
   */
  async getSupporters({ page = 1 } = {}) {
    return this.request(`/supporters?page=${page}`);
  }

  /**
   * Get all supporters (handles pagination automatically)
   * @returns {Promise<Array>} All supporters
   */
  async getAllSupporters() {
    const all = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.getSupporters({ page });
      const data = result.data || [];
      all.push(...data);
      hasMore = result.next_page_url !== null && data.length > 0;
      page++;
    }

    return all;
  }

  /**
   * Get a single supporter by ID
   * @param {number} id - Supporter ID
   * @returns {Promise<Object>} Supporter data
   */
  async getSupporter(id) {
    return this.request(`/supporters/${id}`);
  }

  /**
   * Get paginated subscriptions
   * @param {Object} params
   * @param {number} [params.page=1] - Page number
   * @param {string} [params.status] - Filter by status (active, cancelled, paused)
   * @returns {Promise<Object>} Paginated subscription list
   */
  async getSubscriptions({ page = 1, status } = {}) {
    const params = new URLSearchParams({ page: page.toString() });
    if (status) params.set("status", status);
    return this.request(`/subscriptions?${params}`);
  }

  /**
   * Get all subscriptions (handles pagination automatically)
   * @param {Object} params
   * @param {string} [params.status] - Filter by status
   * @returns {Promise<Array>} All subscriptions
   */
  async getAllSubscriptions({ status } = {}) {
    const all = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const result = await this.getSubscriptions({ page, status });
      const data = result.data || [];
      all.push(...data);
      hasMore = result.next_page_url !== null && data.length > 0;
      page++;
    }

    return all;
  }

  /**
   * Get paginated extras (shop purchases)
   * @param {Object} params
   * @param {number} [params.page=1] - Page number
   * @returns {Promise<Object>} Paginated extras list
   */
  async getExtras({ page = 1 } = {}) {
    return this.request(`/extras?page=${page}`);
  }

  /**
   * Check if token is valid by making a test request
   * @returns {Promise<Object>} Token info and expiry status
   */
  async checkTokenStatus() {
    try {
      const result = await this.getSupporters({ page: 1 });
      return {
        valid: true,
        supporterCount: result.total || 0,
        expiresAt: this.getTokenExpiry(),
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        expiresAt: this.getTokenExpiry(),
      };
    }
  }

  /**
   * Decode JWT to get expiry date (no verification — read-only)
   * @returns {Date|null} Expiry date or null if token is not a JWT
   */
  getTokenExpiry() {
    if (!this.apiToken) return null;
    try {
      const parts = this.apiToken.split(".");
      if (parts.length !== 3) return null;
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      return payload.exp ? new Date(payload.exp * 1000) : null;
    } catch {
      return null;
    }
  }

  /**
   * Get days until token expires
   * @returns {number|null} Days until expiry, or null if unknown
   */
  getDaysUntilExpiry() {
    const expiry = this.getTokenExpiry();
    if (!expiry) return null;
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }
}

export const bmacClient = new BMACClient();
