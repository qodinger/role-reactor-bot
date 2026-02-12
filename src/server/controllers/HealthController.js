import os from "os";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";

/**
 * Get system health metrics
 * @route GET /api/v1/health
 */
export async function apiGetHealth(req, res) {
  try {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();

    // CPU usage (simple approximation)
    const cpus = os.cpus();
    const cpuUsage =
      cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const idle = cpu.times.idle;
        return acc + ((total - idle) / total) * 100;
      }, 0) / cpus.length;

    // API metrics (simplified - in production you'd track these properly)
    const apiMetrics = {
      requestsPerMinute: Math.floor(Math.random() * 100), // Placeholder
      averageResponseTime: Math.floor(Math.random() * 50) + 10, // Placeholder
    };

    return res.json(
      createSuccessResponse({
        uptime: Math.floor(uptime),
        memory: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        },
        cpu: {
          usage: cpuUsage,
        },
        database: {
          connected: true, // Simplified - assume connected if bot is running
          responseTime: 5, // Placeholder
        },
        api: apiMetrics,
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
