import fs from "fs";
import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
  logRequest as logRequestHelper,
} from "../utils/responseHelpers.js";

const logger = getLogger();

/**
 * Basic health check endpoint
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export function healthCheck(req, res) {
  logRequestHelper(logger, "Health check", req, "🏥");

  res.json(
    createSuccessResponse({
      status: "healthy",
      service: "Unified API Server",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || "development",
    }),
  );
}

/**
 * Docker-specific health check endpoint
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export function dockerHealthCheck(req, res) {
  try {
    logRequestHelper(logger, "Docker health check", req, "🐳");

    res.json(
      createSuccessResponse({
        status: "healthy",
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
      }),
    );
  } catch (error) {
    logger.error("❌ Error in Docker health check:", error);
    const { statusCode, response } = createErrorResponse(
      "Docker health check failed",
      500,
      null,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}
