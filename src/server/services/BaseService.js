/**
 * Base Service Class
 * Provides common functionality for all API services
 * Extend this class to create new services
 */

import express from "express";
import { getLogger } from "../../utils/logger.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";

const logger = getLogger();

/**
 * Base Service Class
 * All API services should extend this class
 */
export class BaseService {
  /**
   * Create a new service instance
   * @param {Object} config - Service configuration
   * @param {string} config.name - Service name
   * @param {string} config.version - API version (default: "v1")
   * @param {string} config.basePath - Base path for routes
   * @param {Object} config.metadata - Service metadata
   */
  constructor(config) {
    const { name, version = "v1", basePath, metadata = {} } = config;

    if (!name || !basePath) {
      throw new Error("Service name and basePath are required");
    }

    this.name = name;
    this.version = version;
    this.basePath = basePath;
    this.metadata = metadata;
    this.router = express.Router();
    this.middleware = [];

    // Register common middleware
    this.setupCommonMiddleware();

    const versionDisplay = version.startsWith("v") ? version : `v${version}`;
    logger.debug(
      `Initialized service: ${name} ${versionDisplay} at ${basePath}`,
    );
  }

  /**
   * Setup common middleware for all services
   * Override in subclasses to customize
   */
  setupCommonMiddleware() {
    // Request ID middleware (for tracing)
    this.router.use((req, res, next) => {
      req.requestId =
        req.headers["x-request-id"] ||
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      res.setHeader("X-Request-ID", req.requestId);
      next();
    });

    // Service context middleware
    this.router.use((req, res, next) => {
      req.serviceContext = {
        service: this.name,
        version: this.version,
        basePath: this.basePath,
      };
      next();
    });

    // Health check endpoint (available at /health)
    this.router.get(
      "/health",
      this.asyncHandler(async (req, res) => {
        const healthStatus = await this.getHealthStatus();
        this.sendSuccess(res, healthStatus);
      }),
    );
  }

  /**
   * Add middleware to the service router
   * @param {Function|Array} middleware - Middleware function or array
   * @returns {this} Service instance for chaining
   */
  use(middleware) {
    if (Array.isArray(middleware)) {
      middleware.forEach(mw => {
        this.router.use(mw);
        this.middleware.push(mw);
      });
    } else {
      this.router.use(middleware);
      this.middleware.push(middleware);
    }
    return this;
  }

  /**
   * Register a GET route
   * @param {string} path - Route path
   * @param {...Function} handlers - Route handlers
   * @returns {this} Service instance for chaining
   */
  get(path, ...handlers) {
    this.router.get(path, ...handlers);
    return this;
  }

  /**
   * Register a POST route
   * @param {string} path - Route path
   * @param {...Function} handlers - Route handlers
   * @returns {this} Service instance for chaining
   */
  post(path, ...handlers) {
    this.router.post(path, ...handlers);
    return this;
  }

  /**
   * Register a PUT route
   * @param {string} path - Route path
   * @param {...Function} handlers - Route handlers
   * @returns {this} Service instance for chaining
   */
  put(path, ...handlers) {
    this.router.put(path, ...handlers);
    return this;
  }

  /**
   * Register a DELETE route
   * @param {string} path - Route path
   * @param {...Function} handlers - Route handlers
   * @returns {this} Service instance for chaining
   */
  delete(path, ...handlers) {
    this.router.delete(path, ...handlers);
    return this;
  }

  /**
   * Register a PATCH route
   * @param {string} path - Route path
   * @param {...Function} handlers - Route handlers
   * @returns {this} Service instance for chaining
   */
  patch(path, ...handlers) {
    this.router.patch(path, ...handlers);
    return this;
  }

  /**
   * Send success response
   * @param {import('express').Response} res - Express response object
   * @param {Object} data - Response data
   * @param {number} statusCode - HTTP status code (default: 200)
   */
  sendSuccess(res, data, statusCode = 200) {
    res.status(statusCode).json(createSuccessResponse(data));
  }

  /**
   * Send error response
   * @param {import('express').Response} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {string} hint - Optional hint
   * @param {string} error - Optional error details
   */
  sendError(res, message, statusCode = 500, hint = null, error = null) {
    const { response } = createErrorResponse(message, statusCode, hint, error);
    res.status(statusCode).json(response);
  }

  /**
   * Async route handler wrapper
   * Automatically catches errors and sends error responses
   * @param {Function} handler - Async route handler
   * @returns {Function} Wrapped handler
   */
  asyncHandler(handler) {
    return async (req, res, next) => {
      try {
        await handler(req, res, next);
      } catch (error) {
        logger.error(`Error in ${this.name} service:`, {
          error: error.message,
          stack: error.stack,
          requestId: req.requestId,
          path: req.path,
        });
        this.sendError(
          res,
          error.message || "Internal server error",
          error.statusCode || 500,
        );
      }
    };
  }

  /**
   * Get service health status
   * Override in subclasses to add custom health checks
   * @returns {Object} Health status
   */
  async getHealthStatus() {
    return {
      status: "healthy",
      service: this.name,
      version: this.version,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get service registration info
   * @returns {Object} Service registration information
   */
  getRegistrationInfo() {
    return {
      name: this.name,
      version: this.version,
      basePath: this.basePath,
      router: this.router,
      middleware: this.middleware,
      metadata: this.metadata,
    };
  }
}
