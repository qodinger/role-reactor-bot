/**
 * Services API endpoint
 * Provides information about registered services
 */

import { getLogger } from "../../utils/logger.js";
import { serviceRegistry } from "../services/ServiceRegistry.js";
import {
  createSuccessResponse,
  createErrorResponse,
  logRequest as logRequestHelper,
} from "../utils/responseHelpers.js";

const logger = getLogger();

/**
 * Get all registered services
 * GET /api/services
 */
export function getServices(req, res) {
  logRequestHelper(logger, "Get services", req, "📋");

  try {
    const summary = serviceRegistry.getSummary();
    res.json(createSuccessResponse(summary));
  } catch (error) {
    logger.error("Error getting services:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to get services",
      500,
      null,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Get service by name
 * GET /api/services/:name
 */
export function getService(req, res) {
  const { name } = req.params;
  const { version } = req.query;

  logRequestHelper(logger, `Get service: ${name}`, req, "📋");

  try {
    const service = serviceRegistry.getService(name, version || "v1");

    if (!service) {
      const { response } = createErrorResponse(
        "Service not found",
        404,
        `Service ${name}${version ? ` v${version}` : ""} is not registered`,
      );
      return res.status(404).json(response);
    }

    res.json(createSuccessResponse(service));
  } catch (error) {
    logger.error(`Error getting service ${name}:`, error);
    const { statusCode, response } = createErrorResponse(
      "Failed to get service",
      500,
      null,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}
