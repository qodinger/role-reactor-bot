import { config } from "../../config/config.js";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../utils/responseHelpers.js";

/**
 * Recursively sanitize an object by masking sensitive values
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
function sanitizeConfig(obj) {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  const sanitized = Array.isArray(obj) ? [] : {};
  const sensitiveKeys = [
    "token",
    "secret",
    "password",
    "key",
    "credential",
    "auth",
    "private",
  ];

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if key is sensitive
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = value ? "********" : null;
    } else if (typeof value === "object") {
      // Recurse
      sanitized[key] = sanitizeConfig(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export async function apiGetConfig(req, res) {
  try {
    const fullConfig = config.getAll();
    // Add server-level config from serverConfig.js if needed, but config.js seems comprehensive for bot logic
    // We might want to add some runtime info like uptime, memory usage, etc. but that's in stats.

    const sanitizedWithValues = sanitizeConfig(fullConfig);

    return res.json(
      createSuccessResponse({
        config: sanitizedWithValues,
        environment: config.environment,
        isProduction: config.isProduction,
      }),
    );
  } catch (error) {
    return res
      .status(500)
      .json(
        createErrorResponse(
          "Failed to retrieve configuration",
          500,
          error.message,
        ),
      );
  }
}
