/**
 * Prompt Analytics
 * Tracks prompt usage, performance, and statistics
 */

import { getLogger } from "../../utils/logger.js";

const logger = getLogger();

// Analytics storage
const analytics = {
  usage: new Map(), // Track prompt usage: Map<"type:key", count>
  performance: new Map(), // Track load times: Map<"type:key", [times]>
  errors: new Map(), // Track errors: Map<"type:key", [errors]>
};

/**
 * Track prompt usage
 * @param {string} promptType - Type of prompt ('image' or 'chat')
 * @param {string} promptKey - Key of the prompt
 */
export function trackPromptUsage(promptType, promptKey) {
  const key = `${promptType}:${promptKey}`;
  const current = analytics.usage.get(key) || 0;
  analytics.usage.set(key, current + 1);

  logger.debug(`Prompt usage tracked: ${key} (total: ${current + 1})`);
}

/**
 * Track prompt load performance
 * @param {string} promptType - Type of prompt ('image' or 'chat')
 * @param {number} loadTime - Load time in milliseconds
 */
export function trackPromptPerformance(promptType, loadTime) {
  const key = `${promptType}:load`;
  const times = analytics.performance.get(key) || [];
  times.push(loadTime);

  // Keep only last 100 measurements
  if (times.length > 100) {
    times.shift();
  }

  analytics.performance.set(key, times);
}

/**
 * Track prompt error
 * @param {string} promptType - Type of prompt ('image' or 'chat')
 * @param {string} promptKey - Key of the prompt
 * @param {Error} error - Error object
 */
export function trackPromptError(promptType, promptKey, error) {
  const key = `${promptType}:${promptKey}`;
  const errors = analytics.errors.get(key) || [];
  errors.push({
    message: error.message,
    timestamp: Date.now(),
  });

  // Keep only last 50 errors
  if (errors.length > 50) {
    errors.shift();
  }

  analytics.errors.set(key, errors);

  logger.warn(`Prompt error tracked: ${key} - ${error.message}`);
}

/**
 * Get usage statistics
 * @param {string} promptType - Optional: filter by prompt type
 * @returns {Object} Usage statistics
 */
export function getUsageStats(promptType = null) {
  const stats = {};

  for (const [key, count] of analytics.usage.entries()) {
    const [type, promptKey] = key.split(":");

    if (promptType && type !== promptType) {
      continue;
    }

    if (!stats[type]) {
      stats[type] = {};
    }

    stats[type][promptKey] = count;
  }

  return stats;
}

/**
 * Get performance statistics
 * @param {string} promptType - Optional: filter by prompt type
 * @returns {Object} Performance statistics
 */
export function getPerformanceStats(promptType = null) {
  const stats = {};

  for (const [key, times] of analytics.performance.entries()) {
    const [type, metric] = key.split(":");

    if (promptType && type !== promptType) {
      continue;
    }

    if (times.length === 0) {
      continue;
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    if (!stats[type]) {
      stats[type] = {};
    }

    stats[type][metric] = {
      average: Math.round(avg * 100) / 100,
      min,
      max,
      count: times.length,
    };
  }

  return stats;
}

/**
 * Get error statistics
 * @param {string} promptType - Optional: filter by prompt type
 * @returns {Object} Error statistics
 */
export function getErrorStats(promptType = null) {
  const stats = {};

  for (const [key, errors] of analytics.errors.entries()) {
    const [type, promptKey] = key.split(":");

    if (promptType && type !== promptType) {
      continue;
    }

    if (!stats[type]) {
      stats[type] = {};
    }

    stats[type][promptKey] = {
      count: errors.length,
      recent: errors.slice(-5), // Last 5 errors
    };
  }

  return stats;
}

/**
 * Get all analytics
 * @returns {Object} Complete analytics data
 */
export function getAllAnalytics() {
  return {
    usage: getUsageStats(),
    performance: getPerformanceStats(),
    errors: getErrorStats(),
    timestamp: Date.now(),
  };
}

/**
 * Reset analytics (useful for testing)
 */
export function resetAnalytics() {
  analytics.usage.clear();
  analytics.performance.clear();
  analytics.errors.clear();
  logger.debug("Prompt analytics reset");
}
