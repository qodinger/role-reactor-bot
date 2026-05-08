import os from "os";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";

// API Metrics - shared across middleware and health controller
export const apiMetrics = {
  requestCount: 0,
  totalResponseTime: 0,
  lastResetTime: Date.now(),
};

export function recordRequest(responseTime) {
  apiMetrics.requestCount++;
  apiMetrics.totalResponseTime += responseTime;

  // Reset every minute
  if (Date.now() - apiMetrics.lastResetTime > 60000) {
    apiMetrics.requestCount = 0;
    apiMetrics.totalResponseTime = 0;
    apiMetrics.lastResetTime = Date.now();
  }
}

/**
 * Get system health metrics
 * @route GET /api/v1/health
 */
export async function apiGetHealth(req, res) {
  try {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    // CPU usage (simple approximation)
    const cpus = os.cpus();
    const cpuUsage =
      cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const idle = cpu.times.idle;
        return acc + ((total - idle) / total) * 100;
      }, 0) / cpus.length;

    // Real Database Check
    const dbStatus = { connected: false, responseTime: 0 };
    try {
      const { getDatabaseManager } =
        await import("../../utils/storage/databaseManager.js");
      const dbManager = await getDatabaseManager();
      if (dbManager?.connectionManager) {
        const start = Date.now();
        const isHealthy = dbManager.connectionManager.isConnectionHealthy();
        if (isHealthy) {
          await dbManager.connectionManager.db.admin().ping();
          dbStatus.connected = true;
          dbStatus.responseTime = Date.now() - start;
        }
      }
    } catch (dbError) {
      console.warn("Health check DB ping failed:", dbError.message);
    }

    // API metrics
    const minutesSinceReset = (Date.now() - apiMetrics.lastResetTime) / 60000;
    const requestsPerMinute =
      minutesSinceReset > 0
        ? Math.floor(apiMetrics.requestCount / minutesSinceReset)
        : 0;
    const averageResponseTime =
      apiMetrics.requestCount > 0
        ? Math.floor(apiMetrics.totalResponseTime / apiMetrics.requestCount)
        : 0;

    return res.json(
      createSuccessResponse({
        uptime: Math.floor(uptime),
        memory: {
          used: memUsage.rss,
          total: totalMem,
          free: freeMem,
          percentage: (memUsage.rss / totalMem) * 100,
        },
        cpu: {
          usage: cpuUsage,
        },
        database: dbStatus,
        api: {
          requestsPerMinute,
          averageResponseTime,
        },
        environment: process.env.NODE_ENV || "development",
        isProduction: process.env.NODE_ENV === "production",
      }),
    );
  } catch (error) {
    console.error("Health check error:", error);
    return res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to retrieve health metrics",
          500,
          error.message,
        ),
      );
  }
}
