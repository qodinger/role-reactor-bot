import { getDatabaseManager } from "../../storage/databaseManager.js";
import { getLogger } from "../../logger.js";

/**
 * Checks the health of the database.
 * @returns {Promise<{status: string, duration: number, timestamp: string, error?: string}>}
 */
export async function checkDatabase() {
  const logger = getLogger();
  try {
    const startTime = Date.now();
    const dbManager = await getDatabaseManager();
    const isConnected = await dbManager.healthCheck();
    const duration = Date.now() - startTime;

    return {
      status: isConnected ? "healthy" : "unhealthy",
      duration,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Database health check failed", error);
    return {
      status: "error",
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}
