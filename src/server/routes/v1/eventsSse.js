import express from "express";
import { internalAuth } from "../../middleware/internalAuth.js";
import { sseBroadcaster } from "../../../utils/sseBroadcaster.js";
import { getLogger } from "../../../utils/logger.js";

const logger = getLogger();
const router = express.Router();

/**
 * GET /api/v1/events/:guildId — Server-Sent Events endpoint
 *
 * Streams real-time events (chat messages, stream alerts, status changes)
 * to connected clients (dashboard, OBS overlays).
 *
 * Headers set for SSE: Content-Type, Cache-Control, Connection.
 * Client receives events via EventSource API.
 *
 * Auth: internalAuth middleware (requires INTERNAL_API_KEY).
 */
router.get("/events/:guildId", internalAuth, (req, res) => {
  const { guildId } = req.params;

  // Validate guildId is a Discord snowflake (17-20 digit numeric string)
  if (!/^\d{17,20}$/.test(guildId)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid guild ID format",
    });
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // nginx hint: don't buffer
  res.setHeader("Access-Control-Allow-Origin", "*");
  // Disable compression for SSE (nginx/proxy should not compress streaming)
  res.setHeader("Content-Encoding", "identity");
  res.flushHeaders();

  // Register this client with the broadcaster
  sseBroadcaster.addClient(guildId, res);

  // Log connection
  logger.debug(`SSE endpoint connected for guild ${guildId}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  // Keep the connection alive — do not let Express end the response
  // The SSE broadcaster manages the lifecycle via res.on('close')
  req.on("close", () => {
    // Client disconnected — cleanup handled by sseBroadcaster
  });
});

/**
 * GET /api/v1/events — SSE status endpoint (shows connected clients)
 */
router.get("/events", internalAuth, (req, res) => {
  res.json({
    status: "success",
    totalClients: sseBroadcaster.getTotalClientCount(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
