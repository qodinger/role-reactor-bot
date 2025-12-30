/**
 * Service Registry
 * Centralized registry for API services
 * Allows dynamic registration and discovery of services
 */

import { getLogger } from "../../utils/logger.js";

const logger = getLogger();

/**
 * Service Registry Class
 * Manages registration and discovery of API services
 */
export class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.middleware = new Map();
    this.routeGroups = new Map();
  }

  /**
   * Register an API service
   * @param {Object} service - Service configuration
   * @param {string} service.name - Service name (e.g., "payments", "users")
   * @param {string} service.version - API version (e.g., "v1", "v2")
   * @param {import('express').Router} service.router - Express router instance
   * @param {string} service.basePath - Base path for routes (e.g., "/api/payments")
   * @param {Array} service.middleware - Array of middleware functions
   * @param {Object} service.metadata - Service metadata (description, etc.)
   * @returns {boolean} True if registered successfully
   */
  registerService(service) {
    const { name, version = "v1", router, basePath, middleware = [], metadata = {} } = service;

    if (!name || !router || !basePath) {
      logger.error("Service registration failed: missing required fields", {
        name,
        hasRouter: !!router,
        basePath,
      });
      return false;
    }

    const serviceKey = `${name}:${version}`;

    if (this.services.has(serviceKey)) {
      logger.warn(`Service ${serviceKey} already registered, overwriting...`);
    }

    this.services.set(serviceKey, {
      name,
      version,
      router,
      basePath,
      middleware,
      metadata: {
        ...metadata,
        registeredAt: new Date().toISOString(),
      },
    });

    logger.info(`✅ Registered service: ${serviceKey} at ${basePath}`);
    return true;
  }

  /**
   * Register middleware
   * @param {string} name - Middleware name
   * @param {Function|Array} middleware - Middleware function or array of functions
   * @returns {boolean} True if registered successfully
   */
  registerMiddleware(name, middleware) {
    if (!name || !middleware) {
      logger.error("Middleware registration failed: missing required fields");
      return false;
    }

    this.middleware.set(name, middleware);
    logger.debug(`Registered middleware: ${name}`);
    return true;
  }

  /**
   * Get middleware by name
   * @param {string} name - Middleware name
   * @returns {Function|Array|null} Middleware or null if not found
   */
  getMiddleware(name) {
    return this.middleware.get(name) || null;
  }

  /**
   * Register a route group
   * @param {string} name - Route group name
   * @param {Object} config - Route group configuration
   * @param {string} config.path - Base path
   * @param {import('express').Router} config.router - Express router
   * @param {Array} config.middleware - Middleware array
   * @returns {boolean} True if registered successfully
   */
  registerRouteGroup(name, config) {
    const { path, router, middleware = [] } = config;

    if (!name || !path || !router) {
      logger.error("Route group registration failed: missing required fields");
      return false;
    }

    this.routeGroups.set(name, {
      path,
      router,
      middleware,
      registeredAt: new Date().toISOString(),
    });

    logger.info(`✅ Registered route group: ${name} at ${path}`);
    return true;
  }

  /**
   * Get all registered services
   * @returns {Array} Array of service configurations
   */
  getAllServices() {
    return Array.from(this.services.values());
  }

  /**
   * Get service by name and version
   * @param {string} name - Service name
   * @param {string} version - Service version (default: "v1")
   * @returns {Object|null} Service configuration or null
   */
  getService(name, version = "v1") {
    const serviceKey = `${name}:${version}`;
    return this.services.get(serviceKey) || null;
  }

  /**
   * Get all services by name (all versions)
   * @param {string} name - Service name
   * @returns {Array} Array of service configurations
   */
  getServicesByName(name) {
    return Array.from(this.services.values()).filter(service => service.name === name);
  }

  /**
   * Get all route groups
   * @returns {Array} Array of route group configurations
   */
  getAllRouteGroups() {
    return Array.from(this.routeGroups.values());
  }

  /**
   * Get service registry summary
   * @returns {Object} Registry summary
   */
  getSummary() {
    return {
      services: this.services.size,
      middleware: this.middleware.size,
      routeGroups: this.routeGroups.size,
      serviceList: Array.from(this.services.values()).map(s => ({
        name: s.name,
        version: s.version,
        basePath: s.basePath,
        metadata: s.metadata,
      })),
    };
  }
}

// Export singleton instance
export const serviceRegistry = new ServiceRegistry();

