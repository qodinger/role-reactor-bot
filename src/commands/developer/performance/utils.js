import { getLogger } from "../../../utils/logger.js";
import { EMOJIS } from "../../../config/theme.js";

// ============================================================================
// PERFORMANCE UTILITY FUNCTIONS
// ============================================================================

/**
 * Format performance metrics for display
 * @param {Object} metrics - Performance metrics object
 * @returns {Object} Formatted metrics
 */
export function formatPerformanceMetrics(metrics) {
  return {
    uptime: formatUptime(metrics.uptime),
    eventCount: metrics.events?.total || 0,
    commandCount: metrics.commands?.total || 0,
    avgEventDuration: formatDuration(metrics.events?.avgDuration || 0),
    avgCommandDuration: formatDuration(metrics.commands?.avgDuration || 0),
    eventRate: `${metrics.events?.rate || 0}/min`,
  };
}

/**
 * Calculate performance score based on metrics
 * @param {Object} metrics - Performance metrics
 * @returns {number} Performance score (0-100)
 */
export function calculatePerformanceScore(metrics) {
  let score = 100;

  // Deduct points for slow operations
  if (metrics.events?.avgDuration > 100) {
    score -= Math.min(20, (metrics.events.avgDuration - 100) / 10);
  }

  if (metrics.commands?.avgDuration > 200) {
    score -= Math.min(20, (metrics.commands.avgDuration - 200) / 20);
  }

  // Deduct points for high error rates
  if (metrics.events?.errorRate > 0.05) {
    score -= Math.min(30, metrics.events.errorRate * 100);
  }

  return Math.max(0, Math.round(score));
}

/**
 * Get performance status based on score
 * @param {number} score - Performance score
 * @returns {Object} Status information
 */
export function getPerformanceStatus(score) {
  if (score >= 90) {
    return {
      status: "Excellent",
      emoji: EMOJIS.STATUS.ONLINE,
      color: "#00FF00",
      description: "Performance is optimal!",
    };
  } else if (score >= 75) {
    return {
      status: "Good",
      emoji: EMOJIS.STATUS.IDLE,
      color: "#FFFF00",
      description: "Performance is good with minor issues.",
    };
  } else if (score >= 50) {
    return {
      status: "Fair",
      emoji: "🟠",
      color: "#FFA500",
      description: "Performance needs attention.",
    };
  } else {
    return {
      status: "Poor",
      emoji: EMOJIS.STATUS.OFFLINE,
      color: "#FF0000",
      description: "Performance requires immediate attention!",
    };
  }
}

/**
 * Identify performance bottlenecks
 * @param {Object} metrics - Performance metrics
 * @returns {Array} List of bottlenecks
 */
export function identifyBottlenecks(metrics) {
  const bottlenecks = [];

  if (metrics.events?.avgDuration > 100) {
    bottlenecks.push({
      type: "Event Processing",
      severity: "Medium",
      description: "Event processing is slower than expected",
      recommendation: "Consider optimizing event handlers",
    });
  }

  if (metrics.commands?.avgDuration > 200) {
    bottlenecks.push({
      type: "Command Execution",
      severity: "High",
      description: "Command execution is taking too long",
      recommendation: "Optimize command logic and database queries",
    });
  }

  if (metrics.events?.errorRate > 0.05) {
    bottlenecks.push({
      type: "Error Rate",
      severity: "Critical",
      description: "High error rate detected",
      recommendation: "Investigate and fix error sources",
    });
  }

  return bottlenecks;
}

/**
 * Log performance metrics for monitoring
 * @param {Object} metrics - Performance metrics
 * @param {string} userId - User ID who requested metrics
 */
export function logPerformanceMetrics(metrics, userId) {
  const logger = getLogger();
  const score = calculatePerformanceScore(metrics);
  const status = getPerformanceStatus(score);

  logger.info("Performance metrics requested", {
    userId,
    score,
    status: status.status,
    metrics: {
      eventCount: metrics.events?.total || 0,
      commandCount: metrics.commands?.total || 0,
      avgEventDuration: metrics.events?.avgDuration || 0,
      avgCommandDuration: metrics.commands?.avgDuration || 0,
    },
  });
}

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

function formatUptime(seconds) {
  if (!seconds) return "Unknown";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

function formatDuration(milliseconds) {
  if (milliseconds < 1000) {
    return `${milliseconds.toFixed(2)}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = ((milliseconds % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}
