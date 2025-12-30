/**
 * Service Loader
 * Utility for loading and registering services dynamically
 */

import { getLogger } from "../../utils/logger.js";
import { serviceRegistry } from "../services/ServiceRegistry.js";

const logger = getLogger();

/**
 * Load and register a service
 * @param {Object} serviceConfig - Service configuration
 * @param {string} serviceConfig.name - Service name
 * @param {string} serviceConfig.version - API version
 * @param {string} serviceConfig.basePath - Base path
 * @param {Function} serviceConfig.loader - Service loader function
 * @param {Object} serviceConfig.metadata - Service metadata
 * @returns {boolean} True if loaded successfully
 */
export async function loadService(serviceConfig) {
  const {
    name,
    version = "v1",
    basePath,
    loader,
    metadata = {},
  } = serviceConfig;

  try {
    if (typeof loader !== "function") {
      logger.error(`Service ${name} loader is not a function`);
      return false;
    }

    // Load the service (should return router or service instance)
    const service = await loader();

    // Handle different service return types
    let router;
    let middleware = [];

    if (service.router) {
      // BaseService instance
      router = service.router;
      middleware = service.middleware || [];
    } else if (typeof service === "function") {
      // Express router function
      router = service();
    } else if (service.default) {
      // Default export
      router = service.default;
    } else {
      router = service;
    }

    if (!router) {
      logger.error(`Service ${name} did not return a valid router`);
      return false;
    }

    // Register the service
    const registered = serviceRegistry.registerService({
      name,
      version,
      router,
      basePath,
      middleware,
      metadata,
    });

    if (registered) {
      logger.info(`✅ Loaded service: ${name} v${version}`);
    }

    return registered;
  } catch (error) {
    logger.error(`Failed to load service ${name}:`, error);
    return false;
  }
}

/**
 * Load multiple services
 * @param {Array} services - Array of service configurations
 * @returns {Promise<Object>} Load results
 */
export async function loadServices(services) {
  const results = {
    loaded: [],
    failed: [],
  };

  for (const serviceConfig of services) {
    const loaded = await loadService(serviceConfig);
    if (loaded) {
      results.loaded.push(serviceConfig.name);
    } else {
      results.failed.push(serviceConfig.name);
    }
  }

  return results;
}

/**
 * Auto-discover and load services from directory
 * @param {string} servicesPath - Path to services directory
 * @returns {Promise<Object>} Load results
 */
export async function autoLoadServices(servicesPath) {
  try {
    const { readdir } = await import("fs/promises");
    const { join } = await import("path");
    const files = await readdir(servicesPath);

    const serviceFiles = files.filter(
      file =>
        file.endsWith(".js") && !file.startsWith("_") && file !== "index.js",
    );

    const services = [];

    for (const file of serviceFiles) {
      try {
        const serviceModule = await import(join(servicesPath, file));
        if (serviceModule.serviceConfig) {
          services.push(serviceModule.serviceConfig);
        }
      } catch (error) {
        logger.warn(`Failed to load service from ${file}:`, error);
      }
    }

    return await loadServices(services);
  } catch (error) {
    logger.error("Failed to auto-load services:", error);
    return { loaded: [], failed: [] };
  }
}
