import { getLogger } from "../logger.js";
import { checkDatabase } from "./checkers/database.js";
import { checkMemory } from "./checkers/memory.js";
import { checkPerformance } from "./checkers/performance.js";
import { checkDiscordAPI } from "./checkers/discordApi.js";

class HealthCheckRunner {
  constructor() {
    this.logger = getLogger();
    this.checks = new Map();
    this.lastCheck = null;
    this.checkInterval = 5 * 60 * 1000;
    this.startMonitoring();
  }

  registerCheck(name, checkFunction, timeout = 5000) {
    this.checks.set(name, { checkFunction, timeout });
  }

  async run(client) {
    const startTime = Date.now();
    const results = {};

    for (const [name, { checkFunction, timeout }] of this.checks) {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Health check timeout")), timeout);
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
  }

  determineOverallStatus(results) {
    const statuses = Object.values(results).map(result => result.status);
    if (statuses.includes("error")) return "error";
    if (statuses.includes("warning")) return "warning";
    return "healthy";
  }

  getLastCheck() {
    return this.lastCheck;
  }

  startMonitoring() {
    this.registerCheck("database", checkDatabase);
    this.registerCheck("memory", checkMemory);
    this.registerCheck("performance", checkPerformance);
    this.registerCheck("discord_api", checkDiscordAPI);

    setInterval(() => {
      this.run().catch(error => {
        this.logger.error("Periodic health check failed", error);
      });
    }, this.checkInterval).unref();
  }
}

let healthCheckRunner = null;

export function getHealthCheckRunner() {
  if (!healthCheckRunner) {
    healthCheckRunner = new HealthCheckRunner();
  }
  return healthCheckRunner;
}
