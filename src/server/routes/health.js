/**
 * @fileoverview Health check routes for the API server
 *
 * Provides health check endpoints for monitoring and Docker health checks.
 *
 * @author Tyecode
 * @version 1.0.0
 * @license MIT
 */

import fs from "fs";
import { getLogger } from "../../utils/logger.js";

const logger = getLogger();

/**
 * Basic health check endpoint
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export function healthCheck(req, res) {
  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "Unified API Server",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || "development",
  };

  logger.debug("🏥 Health check requested", {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  res.json(healthData);
}

/**
 * Docker-specific health check endpoint
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export function dockerHealthCheck(req, res) {
  try {
    const dockerInfo = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      docker: {
        environment: process.env.DOCKER_ENV === "true",
        dockerenv: fs.existsSync("/.dockerenv"),
        cgroup:
          fs.existsSync("/proc/1/cgroup") &&
          fs.readFileSync("/proc/1/cgroup", "utf8").includes("docker"),
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
      },
    };

    logger.debug("🐳 Docker health check requested", {
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      timestamp: new Date().toISOString(),
    });

    res.json(dockerInfo);
  } catch (error) {
    logger.error("❌ Error in Docker health check:", error);
    res.status(500).json({
      status: "error",
      message: "Docker health check failed",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
