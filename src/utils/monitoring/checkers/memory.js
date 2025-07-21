import { getLogger } from "../../logger.js";

/**
 * Checks the memory usage of the application.
 * @returns {{status: string, heapUsed: string, heapTotal: string, usagePercent: string, timestamp: string, error?: string}}
 */
export function checkMemory() {
  const logger = getLogger();
  try {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const memoryUsagePercent = (heapUsedMB / heapTotalMB) * 100;

    const isHealthy = memoryUsagePercent < 80;

    return {
      status: isHealthy ? "healthy" : "warning",
      heapUsed: `${heapUsedMB.toFixed(2)} MB`,
      heapTotal: `${heapTotalMB.toFixed(2)} MB`,
      usagePercent: `${memoryUsagePercent.toFixed(2)}%`,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Memory health check failed", error);
    return {
      status: "error",
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}
