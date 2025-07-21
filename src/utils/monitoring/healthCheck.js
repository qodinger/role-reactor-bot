import { getLogger } from "../logger.js";
import { getPerformanceMonitor } from "./performanceMonitor.js";
import { getDatabaseManager } from "../storage/databaseManager.js";

/**
 * Health Check System
 */
class HealthCheck {
  constructor() {
    this.logger = getLogger();
    this.checks = new Map();
    this.lastCheck = null;
    this.checkInterval = 5 * 60 * 1000; // 5 minutes
    this.startMonitoring();
  }

  /**
   * Register a health check
   * @param {string} name - Check name
   * @param {Function} checkFunction - Function that returns health status
   * @param {number} timeout - Timeout in milliseconds
   */
  registerCheck(name, checkFunction, timeout = 5000) {
    this.checks.set(name, { checkFunction, timeout });
  }

  /**
   * Database health check
   * @returns {Promise<Object>} - Database health status
   */
  async checkDatabase() {
    try {
      const startTime = Date.now();
      const dbManager = await getDatabaseManager();

      // Test connection
      const isConnected = await dbManager.healthCheck();
      const duration = Date.now() - startTime;

      return {
        status: isConnected ? "healthy" : "unhealthy",
        duration,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error("Database health check failed", error);
      return {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Memory health check
   * @returns {Object} - Memory health status
   */
  checkMemory() {
    try {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      const heapTotalMB = usage.heapTotal / 1024 / 1024;
      const memoryUsagePercent = (heapUsedMB / heapTotalMB) * 100;

      // Consider unhealthy if memory usage is above 80%
      const isHealthy = memoryUsagePercent < 80;

      return {
        status: isHealthy ? "healthy" : "warning",
        heapUsed: `${heapUsedMB.toFixed(2)} MB`,
        heapTotal: `${heapTotalMB.toFixed(2)} MB`,
        usagePercent: `${memoryUsagePercent.toFixed(2)}%`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error("Memory health check failed", error);
      return {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Performance health check
   * @returns {Object} - Performance health status
   */
  checkPerformance() {
    try {
      const performanceMonitor = getPerformanceMonitor();
      const summary = performanceMonitor.getPerformanceSummary();
      const slowOperations = performanceMonitor.getSlowOperations(2000); // 2s threshold

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
      this.logger.error("Performance health check failed", error);
      return {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Discord API health check
   * @param {Client} client - Discord client
   * @returns {Object} - Discord API health status
   */
  checkDiscordAPI(client) {
    try {
      if (!client || !client.user) {
        return {
          status: "error",
          error: "Client not ready",
          timestamp: new Date().toISOString(),
        };
      }

      const wsPing = client.ws.ping;
      const isHealthy = wsPing < 200; // Consider unhealthy if ping > 200ms

      return {
        status: isHealthy ? "healthy" : "warning",
        ping: `${wsPing}ms`,
        guilds: client.guilds.cache.size,
        users: client.users.cache.size,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error("Discord API health check failed", error);
      return {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Run all health checks
   * @param {Client} client - Discord client
   * @returns {Promise<Object>} - Overall health status
   */
  async runHealthChecks(client) {
    const startTime = Date.now();
    const results = {};

    try {
      // Run all registered checks
      for (const [name, { checkFunction, timeout }] of this.checks) {
        try {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error("Health check timeout")),
              timeout,
            );
          });

          const checkPromise = checkFunction(client);
          results[name] = await Promise.race([checkPromise, timeoutPromise]);
        } catch (error) {
          results[name] = {
            status: "error",
            error: error.message,
            timestamp: new Date().toISOString(),
          };
        }
      }

      // Determine overall status
      const overallStatus = this.determineOverallStatus(results);
      const duration = Date.now() - startTime;

      const healthReport = {
        status: overallStatus,
        checks: results,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      };

      this.lastCheck = healthReport;
      this.logger.info("Health check completed", healthReport);

      return healthReport;
    } catch (error) {
      this.logger.error("Health check failed", error);
      return {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Determine overall health status
   * @param {Object} results - Health check results
   * @returns {string} - Overall status
   */
  determineOverallStatus(results) {
    const statuses = Object.values(results).map(result => result.status);

    if (statuses.includes("error")) {
      return "error";
    } else if (statuses.includes("warning")) {
      return "warning";
    } else {
      return "healthy";
    }
  }

  /**
   * Get last health check results
   * @returns {Object|null} - Last health check results
   */
  getLastHealthCheck() {
    return this.lastCheck;
  }

  /**
   * Start monitoring
   */
  startMonitoring() {
    // Register default health checks
    this.registerCheck("database", () => this.checkDatabase());
    this.registerCheck("memory", () => this.checkMemory());
    this.registerCheck("performance", () => this.checkPerformance());
    this.registerCheck("discord_api", client => this.checkDiscordAPI(client));

    // Run periodic health checks
    setInterval(() => {
      // We'll need to pass the client when available
      this.runHealthChecks().catch(error => {
        this.logger.error("Periodic health check failed", error);
      });
    }, this.checkInterval).unref();
  }

  /**
   * Get health check summary for production monitoring
   * @param {Client} client - Discord client
   * @returns {Promise<Object>} - Health summary for production
   */
  async getHealthSummary(client) {
    try {
      const checks = await this.runHealthChecks(client);

      // Production-ready health summary
      const summary = {
        status: checks.status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || "1.0.0",
        environment: process.env.NODE_ENV || "development",
        checks: {
          database: checks.checks?.database?.status || "unknown",
          memory: checks.checks?.memory?.status || "unknown",
          performance: checks.checks?.performance?.status || "unknown",
          discord_api: checks.checks?.discord_api?.status || "unknown",
        },
        metrics: {
          guilds: client?.guilds?.cache?.size || 0,
          users: client?.users?.cache?.size || 0,
          ping: client?.ws?.ping || 0,
          memory: process.memoryUsage(),
        },
      };

      return summary;
    } catch (error) {
      this.logger.error("Failed to generate health summary", error);
      return {
        status: "error",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Format check details for display
   * @param {string} name - Check name
   * @param {Object} result - Check result
   * @returns {string} - Formatted details
   */
  formatCheckDetails(name, result) {
    switch (name) {
      case "database":
        return result.status === "healthy"
          ? `Connected (${result.duration}ms)`
          : `Error: ${result.error}`;

      case "memory":
        return result.status === "healthy"
          ? `${result.heapUsed} / ${result.heapTotal} (${result.usagePercent})`
          : `High usage: ${result.usagePercent}`;

      case "performance":
        return result.status === "healthy"
          ? `Uptime: ${result.uptime}, Events: ${result.totalEvents}, Commands: ${result.totalCommands}`
          : `${result.slowEvents} slow events, ${result.slowCommands} slow commands`;

      case "discord_api":
        return result.status === "healthy"
          ? `Ping: ${result.ping}, Guilds: ${result.guilds}`
          : `High ping: ${result.ping}`;

      default:
        return result.status === "healthy"
          ? "OK"
          : result.error || "Unknown error";
    }
  }
}

// Singleton instance
let healthCheck = null;

/**
 * Get health check instance
 * @returns {HealthCheck} - Health check instance
 */
export function getHealthCheck() {
  if (!healthCheck) {
    healthCheck = new HealthCheck();
  }
  return healthCheck;
}

export default HealthCheck;
