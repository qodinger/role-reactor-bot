/**
 * Performance monitoring for AI requests
 * Tracks response times, error rates, and provider performance
 */
import {
  PERFORMANCE_METRICS_ENABLED,
  PERFORMANCE_LOG_THRESHOLD,
  MAX_METRICS_HISTORY,
} from "./constants.js";
import { getLogger } from "../logger.js";

const logger = getLogger();

/**
 * Performance metrics storage
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: [],
      errors: [],
      providerStats: new Map(), // provider -> { count, totalTime, errors }
    };
    this.enabled = PERFORMANCE_METRICS_ENABLED;
  }

  /**
   * Record a request metric
   * @param {Object} metric - Metric data
   * @param {string} metric.provider - Provider used
   * @param {number} metric.responseTime - Response time in ms
   * @param {boolean} metric.success - Whether request succeeded
   * @param {string} metric.error - Error message if failed
   */
  recordRequest({ provider, responseTime, success, error = null }) {
    if (!this.enabled) return;

    const metric = {
      provider,
      responseTime,
      success,
      error,
      timestamp: Date.now(),
    };

    // Add to history
    this.metrics.requests.push(metric);
    if (this.metrics.requests.length > MAX_METRICS_HISTORY) {
      this.metrics.requests.shift(); // Remove oldest
    }

    // Update provider stats
    if (!this.metrics.providerStats.has(provider)) {
      this.metrics.providerStats.set(provider, {
        count: 0,
        totalTime: 0,
        errors: 0,
        success: 0,
      });
    }

    const stats = this.metrics.providerStats.get(provider);
    stats.count++;
    stats.totalTime += responseTime;
    if (success) {
      stats.success++;
    } else {
      stats.errors++;
      if (error) {
        this.metrics.errors.push({
          provider,
          error,
          timestamp: Date.now(),
        });
        if (this.metrics.errors.length > MAX_METRICS_HISTORY) {
          this.metrics.errors.shift();
        }
      }
    }

    // Log slow requests
    if (responseTime > PERFORMANCE_LOG_THRESHOLD) {
      logger.warn(
        `[Performance] Slow request detected: ${provider} took ${responseTime}ms (threshold: ${PERFORMANCE_LOG_THRESHOLD}ms)`,
      );
    }
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance stats
   */
  getStats() {
    if (this.metrics.requests.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        providerStats: {},
      };
    }

    const totalRequests = this.metrics.requests.length;
    const totalTime = this.metrics.requests.reduce(
      (sum, m) => sum + m.responseTime,
      0,
    );
    const errors = this.metrics.requests.filter(m => !m.success).length;
    const averageResponseTime = totalTime / totalRequests;
    const errorRate = (errors / totalRequests) * 100;

    // Calculate percentiles
    const sortedTimes = this.metrics.requests
      .map(m => m.responseTime)
      .sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
    const p90 = sortedTimes[Math.floor(sortedTimes.length * 0.9)];
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];

    // Provider stats
    const providerStats = {};
    for (const [provider, stats] of this.metrics.providerStats.entries()) {
      providerStats[provider] = {
        count: stats.count,
        averageTime: stats.totalTime / stats.count,
        errorRate: (stats.errors / stats.count) * 100,
        successRate: (stats.success / stats.count) * 100,
      };
    }

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      percentiles: {
        p50: Math.round(p50),
        p90: Math.round(p90),
        p95: Math.round(p95),
      },
      providerStats,
    };
  }

  /**
   * Get recent errors
   * @param {number} limit - Number of recent errors to return
   * @returns {Array} Recent errors
   */
  getRecentErrors(limit = 10) {
    return this.metrics.errors.slice(-limit);
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      requests: [],
      errors: [],
      providerStats: new Map(),
    };
    logger.info("[Performance] Metrics reset");
  }
}

export const performanceMonitor = new PerformanceMonitor();
