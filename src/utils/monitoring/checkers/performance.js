import { getPerformanceMonitor } from "../performanceMonitor.js";
import { getLogger } from "../../logger.js";

const SLOW_OPERATION_THRESHOLD = 2000; // ms

export function checkPerformance() {
  const logger = getLogger();
  try {
    const performanceMonitor = getPerformanceMonitor();
    const summary = performanceMonitor.getPerformanceSummary();
    let slowCommands = 0;
    let slowEvents = 0;

    for (const metric of performanceMonitor.commands.metrics.values()) {
      if (metric.averageDuration > SLOW_OPERATION_THRESHOLD) {
        slowCommands++;
      }
    }

    for (const metric of performanceMonitor.events.metrics.values()) {
      if (metric.averageDuration > SLOW_OPERATION_THRESHOLD) {
        slowEvents++;
      }
    }

    const isHealthy = slowCommands === 0 && slowEvents === 0;

    return {
      status: isHealthy ? "healthy" : "warning",
      uptime: summary.uptime,
      totalEvents: summary.events.total,
      totalCommands: summary.commands.total,
      slowEvents,
      slowCommands,
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
