import { getLogger } from "../../utils/logger.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";
import { logRequest as logRequestHelper } from "../utils/apiShared.js";

const logger = getLogger();

// Get package.json data
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let packageDataCache = null;

/**
 * Format package name to readable format
 * @param {string} name - Package name (e.g., "role-reactor-bot")
 * @returns {string} Formatted name (e.g., "Role Reactor Bot")
 */
function formatPackageName(name) {
  return name
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Get package.json data
 * @returns {Object} Package.json data
 */
function getPackageData() {
  if (packageDataCache) {
    return packageDataCache;
  }

  try {
    const packageJsonPath = join(__dirname, "../../../package.json");
    packageDataCache = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    return packageDataCache;
  } catch (error) {
    logger.error("Failed to read package.json", error);
    return {
      name: "role-reactor-bot",
      version: "Unknown",
      description:
        "A powerful Discord bot that helps you manage your server with role management, AI features, moderation tools, and community engagement features. Perfect for communities of all sizes.",
    };
  }
}

/**
 * Log API request
 * @param {string} endpoint - Endpoint name
 * @param {import('express').Request} req - Express request object
 */
function logRequest(endpoint, req) {
  logRequestHelper(endpoint, req);
}

/**
 * API info endpoint - Detailed server information
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export function apiInfo(req, res) {
  logRequest("API info", req);

  const packageData = getPackageData();
  const formattedName = formatPackageName(packageData.name);

  res.json(
    createSuccessResponse({
      message: "Unified API Server Information",
      server: {
        name: `${formattedName} API Server`,
        version: packageData.version,
        description: packageData.description,
      },
      features: {
        webhooks: true,
        healthChecks: true,
        cors: true,
        requestLogging: true,
        errorHandling: true,
      },
    }),
  );
}
