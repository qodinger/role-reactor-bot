import { getLogger } from "../../../utils/logger.js";

// ============================================================================
// STORAGE UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate storage configuration
 * @param {Object} config - Storage configuration object
 * @returns {Object} Validation result
 */
export function validateStorageConfig(config) {
  const errors = [];
  const warnings = [];

  if (!config.provider) {
    errors.push("Storage provider is not configured");
  }

  if (config.provider === "database" && !config.database?.connectionString) {
    errors.push("Database connection string is missing");
  }

  if (config.provider === "file" && !config.file?.path) {
    errors.push("File storage path is not configured");
  }

  if (config.backup?.enabled && !config.backup?.schedule) {
    warnings.push("Backup is enabled but no schedule is configured");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculate storage usage statistics
 * @param {Object} storageData - Raw storage data
 * @returns {Object} Formatted statistics
 */
export function calculateStorageStats(storageData) {
  const stats = {
    totalItems: 0,
    totalSize: 0,
    itemTypes: {},
    oldestItem: null,
    newestItem: null,
  };

  try {
    // Count items and calculate sizes
    Object.entries(storageData).forEach(([type, items]) => {
      if (Array.isArray(items)) {
        stats.totalItems += items.length;
        stats.itemTypes[type] = items.length;

        items.forEach(item => {
          if (item.size) {
            stats.totalSize += item.size;
          }

          if (item.createdAt) {
            const date = new Date(item.createdAt);
            if (!stats.oldestItem || date < stats.oldestItem) {
              stats.oldestItem = date;
            }
            if (!stats.newestItem || date > stats.newestItem) {
              stats.newestItem = date;
            }
          }
        });
      }
    });

    // Format dates
    if (stats.oldestItem) {
      stats.oldestItem = stats.oldestItem.toISOString().split("T")[0];
    }
    if (stats.newestItem) {
      stats.newestItem = stats.newestItem.toISOString().split("T")[0];
    }
  } catch (error) {
    getLogger().error("Error calculating storage stats:", error);
  }

  return stats;
}

/**
 * Get storage health indicators
 * @param {Object} storageData - Storage data and metrics
 * @returns {Object} Health indicators
 */
export function getStorageHealthIndicators(storageData) {
  const indicators = {
    status: "healthy",
    issues: [],
    recommendations: [],
  };

  try {
    // Check for data corruption
    if (storageData.corruptedItems > 0) {
      indicators.status = "warning";
      indicators.issues.push(
        `${storageData.corruptedItems} corrupted items detected`,
      );
      indicators.recommendations.push(
        "Run data integrity check and repair corrupted items",
      );
    }

    // Check for excessive memory usage
    if (storageData.memoryUsage > 0.8) {
      // 80% threshold
      indicators.status = "warning";
      indicators.issues.push("High memory usage detected");
      indicators.recommendations.push(
        "Consider implementing data cleanup or archiving",
      );
    }

    // Check for slow response times
    if (storageData.avgResponseTime > 1000) {
      // 1 second threshold
      indicators.status = "warning";
      indicators.issues.push("Slow storage response times");
      indicators.recommendations.push(
        "Investigate storage performance bottlenecks",
      );
    }

    // Check for connection issues
    if (storageData.connectionErrors > 0) {
      indicators.status = "error";
      indicators.issues.push(
        `${storageData.connectionErrors} connection errors`,
      );
      indicators.recommendations.push(
        "Check storage system connectivity and credentials",
      );
    }

    // Determine overall status
    if (indicators.issues.some(issue => issue.includes("error"))) {
      indicators.status = "error";
    } else if (indicators.issues.length > 0) {
      indicators.status = "warning";
    }
  } catch (error) {
    getLogger().error("Error getting storage health indicators:", error);
    indicators.status = "unknown";
    indicators.issues.push("Unable to determine health status");
  }

  return indicators;
}

/**
 * Format storage size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
export function formatStorageSize(bytes) {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.log(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Calculate storage efficiency metrics
 * @param {Object} storageData - Storage data
 * @returns {Object} Efficiency metrics
 */
export function calculateStorageEfficiency(storageData) {
  const metrics = {
    compressionRatio: 1.0,
    cacheHitRate: 0.0,
    fragmentationLevel: 0.0,
    utilizationRate: 0.0,
  };

  try {
    if (storageData.compressedSize && storageData.originalSize) {
      metrics.compressionRatio =
        storageData.originalSize / storageData.compressedSize;
    }

    if (
      storageData.cacheHits !== undefined &&
      storageData.cacheMisses !== undefined
    ) {
      const total = storageData.cacheHits + storageData.cacheMisses;
      metrics.cacheHitRate =
        total > 0 ? (storageData.cacheHits / total) * 100 : 0;
    }

    if (storageData.fragmentedSpace && storageData.totalSpace) {
      metrics.fragmentationLevel =
        (storageData.fragmentedSpace / storageData.totalSpace) * 100;
    }

    if (storageData.usedSpace && storageData.totalSpace) {
      metrics.utilizationRate =
        (storageData.usedSpace / storageData.totalSpace) * 100;
    }
  } catch (error) {
    getLogger().error("Error calculating storage efficiency:", error);
  }

  return metrics;
}

/**
 * Log storage access for monitoring
 * @param {string} operation - Storage operation performed
 * @param {string} userId - User ID who performed the operation
 * @param {Object} metadata - Additional operation metadata
 */
export function logStorageAccess(operation, userId, metadata = {}) {
  const logger = getLogger();

  logger.info("Storage access logged", {
    operation,
    userId,
    timestamp: new Date().toISOString(),
    metadata,
  });
}
