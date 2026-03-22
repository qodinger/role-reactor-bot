import v8 from "v8";
import { getLogger } from "../../logger.js";

/**
 * Checks the memory usage of the application.
 * @returns {{status: string, heapUsed: string, heapTotal: string, heapLimit: string, usagePercent: string, timestamp: string, error?: string}}
 */
export function checkMemory() {
  const logger = getLogger();
  try {
    const usage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();

    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const heapLimitMB = heapStats.heap_size_limit / 1024 / 1024;

    // Use heap limit for usage percentage as it shows the actual capacity
    const memoryUsagePercent = (heapUsedMB / heapLimitMB) * 100;

    // Use a higher threshold for warning when compared to the limit
    const isHealthy = memoryUsagePercent < 85;

    return {
      status: isHealthy ? "healthy" : "warning",
      heapUsed: `${heapUsedMB.toFixed(2)} MB`,
      heapTotal: `${heapTotalMB.toFixed(2)} MB`,
      heapLimit: `${heapLimitMB.toFixed(2)} MB`,
      usagePercent: `${memoryUsagePercent.toFixed(2)}%`,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Memory health check failed", error);
    return {
      status: "error",
      heapUsed: "0 MB",
      heapTotal: "0 MB",
      heapLimit: "0 MB",
      usagePercent: "0%",
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}
