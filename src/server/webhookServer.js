import express from "express";
import { handleKoFiWebhook } from "../webhooks/kofi.js";
import { getLogger } from "../utils/logger.js";

const logger = getLogger();
const app = express();
const PORT = process.env.WEBHOOK_PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "AI Avatar Webhook Server",
  });
});

// Test webhook endpoint
app.get("/webhook/test", (req, res) => {
  const logger = getLogger();

  logger.info("🧪 Webhook test endpoint accessed", {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  res.json({
    status: "success",
    message: "Webhook API is working!",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      kofi: "/webhook/kofi",
      test: "/webhook/test",
    },
    server: {
      port: PORT,
      environment: process.env.NODE_ENV || "development",
    },
  });
});

// Test webhook POST endpoint
app.post("/webhook/test", (req, res) => {
  const logger = getLogger();

  logger.info("🧪 Webhook test POST endpoint accessed", {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    body: req.body,
    headers: req.headers,
    timestamp: new Date().toISOString(),
  });

  res.json({
    status: "success",
    message: "Webhook POST endpoint is working!",
    received: {
      method: req.method,
      body: req.body,
      headers: {
        contentType: req.get("Content-Type"),
        userAgent: req.get("User-Agent"),
      },
    },
    timestamp: new Date().toISOString(),
  });
});

// Ko-fi webhook endpoint
app.post("/webhook/kofi", handleKoFiWebhook);

// Error handling middleware
app.use((error, req, res, _next) => {
  logger.error("Webhook server error:", error);
  res.status(500).json({ error: "Internal server error" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

export function startWebhookServer() {
  app.listen(PORT, () => {
    logger.info(`Webhook server running on port ${PORT}`);
    logger.info(`Available endpoints:`);
    logger.info(`  Health: http://localhost:${PORT}/health`);
    logger.info(`  Test: http://localhost:${PORT}/webhook/test`);
    logger.info(`  Ko-fi: http://localhost:${PORT}/webhook/kofi`);
  });
}

export default app;
