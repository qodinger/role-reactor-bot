import { getLogger } from "../../logger.js";

/**
 * Checks the health of the Discord API connection.
 * @param {import("discord.js").Client} client The Discord client.
 * @returns {{status: string, ping?: string, guilds?: number, users?: number, timestamp: string, error?: string}}
 */
export function checkDiscordAPI(client) {
  const logger = getLogger();
  try {
    if (!client || !client.user) {
      return {
        status: "error",
        error: "Client not ready",
        timestamp: new Date().toISOString(),
      };
    }

    const wsPing = client.ws.ping;
    const isHealthy = wsPing < 200;

    return {
      status: isHealthy ? "healthy" : "warning",
      ping: `${wsPing}ms`,
      guilds: client.guilds.cache.size,
      users: client.users.cache.size,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Discord API health check failed", error);
    return {
      status: "error",
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}
