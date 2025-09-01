import { getLogger } from "../../../utils/logger.js";

// ============================================================================
// HEALTH UTILITY FUNCTIONS
// ============================================================================

/**
 * Format memory usage for display
 * @param {number} bytes - Memory in bytes
 * @returns {string} Formatted memory string
 */
export function formatMemory(bytes) {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format duration for display
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
export function formatDuration(milliseconds) {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = ((milliseconds % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Check if a value indicates a healthy status
 * @param {any} value - Value to check
 * @returns {boolean} Whether the value indicates health
 */
export function isHealthy(value) {
  if (typeof value === "string") {
    return (
      value.includes("✅") || value.includes("Good") || value.includes("Ready")
    );
  }
  if (typeof value === "number") {
    return value > 0 && value < 1000; // Example threshold
  }
  return Boolean(value);
}

/**
 * Get health status emoji based on value
 * @param {any} value - Value to evaluate
 * @returns {string} Appropriate emoji
 */
export function getHealthEmoji(value) {
  if (isHealthy(value)) {
    return "✅";
  } else if (value === "⚠️" || value.includes("High")) {
    return "⚠️";
  } else {
    return "❌";
  }
}

/**
 * Log health check metrics
 * @param {Object} metrics - Health metrics object
 * @param {string} userId - User ID who requested health check
 */
export function logHealthMetrics(metrics, userId) {
  const logger = getLogger();

  logger.info("Health check metrics", {
    userId,
    metrics: {
      botReady: metrics.bot_ready,
      websocketPing: metrics.ping,
      memoryUsage: metrics.memory,
      serverCount: metrics.guilds,
      uptime: metrics.uptime,
    },
  });
}
