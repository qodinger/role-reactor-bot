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
    logger.info(`Ko-fi webhook URL: http://localhost:${PORT}/webhook/kofi`);
  });
}

export default app;
