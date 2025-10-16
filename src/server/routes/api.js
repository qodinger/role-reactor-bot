/**
 * @fileoverview API routes for the unified server
 *
 * Provides general API endpoints and status information.
 *
 * @author Tyecode
 * @version 1.0.0
 * @license MIT
 */

import { getLogger } from "../../utils/logger.js";

const logger = getLogger();

/**
 * API status endpoint
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export function apiStatus(req, res) {
  logger.debug("📊 API status requested", {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  res.json({
    status: "success",
    message: "API is running",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      healthDocker: "/health/docker",
      test: "/webhook/test",
      verify: "/webhook/verify",
      kofi: "/webhook/kofi",
      api: "/api/*",
    },
    server: {
      port: process.env.API_PORT || 3030,
      environment: process.env.NODE_ENV || "development",
      uptime: process.uptime(),
    },
  });
}

/**
 * API info endpoint with detailed server information
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export function apiInfo(req, res) {
  logger.debug("ℹ️ API info requested", {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  res.json({
    status: "success",
    message: "Unified API Server Information",
    timestamp: new Date().toISOString(),
    server: {
      name: "Role Reactor Bot API Server",
      version: "1.0.0",
      port: process.env.API_PORT || 3030,
      environment: process.env.NODE_ENV || "development",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    },
    features: {
      webhooks: true,
      healthChecks: true,
      cors: true,
      requestLogging: true,
      errorHandling: true,
    },
    endpoints: {
      health: {
        path: "/health",
        methods: ["GET"],
        description: "Basic health check",
      },
      healthDocker: {
        path: "/health/docker",
        methods: ["GET"],
        description: "Docker-specific health check",
      },
      webhookTest: {
        path: "/webhook/test",
        methods: ["GET", "POST"],
        description: "Webhook testing endpoint",
      },
      webhookVerify: {
        path: "/webhook/verify",
        methods: ["POST"],
        description: "Webhook token verification",
      },
      webhookKofi: {
        path: "/webhook/kofi",
        methods: ["POST"],
        description: "Ko-fi webhook handler",
      },
      apiStatus: {
        path: "/api/status",
        methods: ["GET"],
        description: "API status information",
      },
      apiInfo: {
        path: "/api/info",
        methods: ["GET"],
        description: "Detailed API information",
      },
    },
  });
}
