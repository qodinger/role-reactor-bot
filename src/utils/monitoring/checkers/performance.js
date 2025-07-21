import { getPerformanceMonitor } from "../performanceMonitor.js";
import { getLogger } from "../../logger.js";

/**
 * Checks the performance of the application.
 * @returns {{status: string, uptime: string, totalEvents: number, totalCommands: number, slowEvents: number, slowCommands: number, timestamp: string, error?: string}}
 */
export function checkPerformance() {
  const logger = getLogger();
  try {
    const performanceMonitor = getPerformanceMonitor();
    const summary = performanceMonitor.getPerformanceSummary();
    const slowOperations = performanceMonitor.getSlowOperations(2000);

    const isHealthy =
      slowOperations.slowEvents.length === 0 &&
      slowOperations.slowCommands.length === 0;

    return {
      status: isHealthy ? "healthy" : "warning",
      uptime: summary.uptime.formatted,
      totalEvents: summary.events.total,
      totalCommands: summary.commands.total,
      slowEvents: slowOperations.slowEvents.length,
      slowCommands: slowOperations.slowCommands.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Performance health check failed", error);
    return {
      status: "error",
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}
