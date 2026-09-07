import { getLogger } from "./logger.js";

const logger = getLogger();

/** Max concurrent SSE clients per guild */
const MAX_CLIENTS_PER_GUILD =
  parseInt(process.env.SSE_MAX_CLIENTS_PER_GUILD, 10) || 100;

/**
 * SSEBroadcaster — singleton that manages Server-Sent Events connections per guild.
 *
 * StreamingManager broadcasts events here; SSE endpoints register client responses.
 * When no clients are connected for a guild, broadcast() returns immediately (zero overhead).
 *
 * @example
 *   import { sseBroadcaster } from "../utils/sseBroadcaster.js";
 *   sseBroadcaster.broadcast(guildId, "stream.chat", { username, message });
 */
class SSEBroadcaster {
  constructor() {
    /** @type {Map<string, Set<import('express').Response>>} */
    this.clients = new Map();
    this.keepaliveIntervals = new Map();
  }

  /**
   * Register an SSE client response for a guild.
   * Sets headers, sends initial connected event, starts keepalive.
   * @param {string} guildId
   * @param {import('express').Response} res
   */
  addClient(guildId, res) {
    if (!this.clients.has(guildId)) {
      this.clients.set(guildId, new Set());
    }

    const guildClients = this.clients.get(guildId);

    // Enforce max connections per guild
    if (guildClients.size >= MAX_CLIENTS_PER_GUILD) {
      logger.warn(
        `SSE connection rejected for guild ${guildId} — max ${MAX_CLIENTS_PER_GUILD} clients reached`,
      );
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: "max_connections_reached", max: MAX_CLIENTS_PER_GUILD })}\n\n`,
      );
      res.end();
      return;
    }

    guildClients.add(res);
    const count = guildClients.size;
    logger.debug(`SSE client connected for guild ${guildId} (total: ${count})`);

    // Send initial connected event
    res.write(
      `event: connected\ndata: ${JSON.stringify({ guildId, clients: count })}\n\n`,
    );

    // Start keepalive for this guild if not already running
    if (!this.keepaliveIntervals.has(guildId)) {
      const interval = setInterval(() => {
        const clients = this.clients.get(guildId);
        if (!clients || clients.size === 0) {
          clearInterval(this.keepaliveIntervals.get(guildId));
          this.keepaliveIntervals.delete(guildId);
          return;
        }
        for (const client of clients) {
          try {
            client.write(":keepalive\n\n");
          } catch {
            this.removeClient(guildId, client);
          }
        }
      }, 30000);
      this.keepaliveIntervals.set(guildId, interval);
    }

    // Cleanup on disconnect
    res.on("close", () => {
      this.removeClient(guildId, res);
    });
  }

  /**
   * Remove an SSE client from a guild.
   * @param {string} guildId
   * @param {import('express').Response} res
   */
  removeClient(guildId, res) {
    const guildClients = this.clients.get(guildId);
    if (!guildClients) return;

    guildClients.delete(res);
    logger.debug(
      `SSE client disconnected for guild ${guildId} (remaining: ${guildClients.size})`,
    );

    // Clean up empty guild entries
    if (guildClients.size === 0) {
      this.clients.delete(guildId);
      if (this.keepaliveIntervals.has(guildId)) {
        clearInterval(this.keepaliveIntervals.get(guildId));
        this.keepaliveIntervals.delete(guildId);
      }
    }
  }

  /**
   * Broadcast an event to all connected SSE clients for a guild.
   * Returns immediately if no clients are connected (zero overhead).
   * @param {string} guildId
   * @param {string} eventType - SSE event type (e.g., "stream.chat", "stream.alert")
   * @param {Object} data - Event data (will be JSON-serialized)
   */
  broadcast(guildId, eventType, data) {
    const guildClients = this.clients.get(guildId);
    if (!guildClients || guildClients.size === 0) return;

    const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    const deadClients = [];

    for (const client of guildClients) {
      try {
        client.write(payload);
      } catch {
        deadClients.push(client);
      }
    }

    // Clean up any broken connections
    for (const dead of deadClients) {
      this.removeClient(guildId, dead);
    }
  }

  /**
   * Get the number of connected SSE clients for a guild.
   * @param {string} guildId
   * @returns {number}
   */
  getClientCount(guildId) {
    return this.clients.get(guildId)?.size ?? 0;
  }

  /**
   * Get total connected clients across all guilds.
   * @returns {number}
   */
  getTotalClientCount() {
    let total = 0;
    for (const clients of this.clients.values()) {
      total += clients.size;
    }
    return total;
  }

  /**
   * Disconnect all clients and clear all intervals.
   */
  shutdown() {
    for (const [, clients] of this.clients) {
      for (const client of clients) {
        try {
          client.write(
            `event: shutdown\ndata: ${JSON.stringify({ reason: "server_shutdown" })}\n\n`,
          );
          client.end();
        } catch {
          // ignore
        }
      }
    }
    this.clients.clear();
    for (const interval of this.keepaliveIntervals.values()) {
      clearInterval(interval);
    }
    this.keepaliveIntervals.clear();
  }
}

/** Singleton instance */
export const sseBroadcaster = new SSEBroadcaster();
