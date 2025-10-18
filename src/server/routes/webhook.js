import { getLogger } from "../../utils/logger.js";

const logger = getLogger();

/**
 * Test webhook GET endpoint
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export function testWebhookGet(req, res) {
  logger.info("🧪 Webhook test GET endpoint accessed", {
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
      test: "/webhook/test",
      verify: "/webhook/verify",
      kofi: "/webhook/kofi",
    },
    server: {
      port: process.env.API_PORT || 3030,
      environment: process.env.NODE_ENV || "development",
    },
  });
}

/**
 * Test webhook POST endpoint
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export function testWebhookPost(req, res) {
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
}

/**
 * Webhook token verification endpoint
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export function verifyWebhookToken(req, res) {
  try {
    logger.info("🔐 Webhook verification endpoint accessed", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      timestamp: new Date().toISOString(),
    });

    // Get the token from request body or headers
    const providedToken =
      req.body.token || req.headers["x-webhook-token"] || req.query.token;
    const expectedToken = process.env.KOFI_WEBHOOK_TOKEN;

    if (!providedToken) {
      logger.warn("❌ No webhook token provided in verification request");
      return res.status(400).json({
        status: "error",
        message: "No webhook token provided",
        hint: "Provide token via body.token, x-webhook-token header, or ?token query parameter",
        timestamp: new Date().toISOString(),
      });
    }

    if (!expectedToken) {
      logger.warn("⚠️ No webhook token configured in environment");
      return res.status(500).json({
        status: "error",
        message: "Webhook token not configured on server",
        hint: "Set KOFI_WEBHOOK_TOKEN environment variable",
        timestamp: new Date().toISOString(),
      });
    }

    // Verify the token
    const isValid = providedToken === expectedToken;

    logger.info(
      `🔍 Token verification result: ${isValid ? "VALID" : "INVALID"}`,
      {
        providedTokenLength: providedToken.length,
        expectedTokenLength: expectedToken.length,
        tokenMatch: isValid,
        timestamp: new Date().toISOString(),
      },
    );

    if (isValid) {
      res.json({
        status: "success",
        message: "Webhook token is valid!",
        verification: {
          tokenProvided: true,
          tokenValid: true,
          tokenLength: providedToken.length,
          serverConfigured: true,
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(401).json({
        status: "error",
        message: "Invalid webhook token",
        verification: {
          tokenProvided: true,
          tokenValid: false,
          tokenLength: providedToken.length,
          serverConfigured: true,
        },
        hint: "Check your webhook token configuration",
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error("❌ Error in webhook verification:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error during verification",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
