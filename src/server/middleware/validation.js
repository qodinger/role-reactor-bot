/**
 * Request validation middleware
 * Provides common validation utilities for API routes
 */

import { getLogger } from "../../utils/logger.js";
import { createErrorResponse } from "../utils/responseHelpers.js";

const logger = getLogger();

/**
 * Validate request body against schema
 * @param {Object} schema - Validation schema
 * @returns {Function} Express middleware
 */
export function validateBody(schema) {
  return (req, res, next) => {
    try {
      const { body } = req;
      const errors = [];

      // Validate required fields
      if (schema.required) {
        for (const field of schema.required) {
          if (body[field] === undefined || body[field] === null) {
            errors.push(`Missing required field: ${field}`);
          }
        }
      }

      // Validate field types
      if (schema.properties) {
        for (const [field, config] of Object.entries(schema.properties)) {
          if (body[field] !== undefined) {
            const value = body[field];
            const { type, min, max, pattern, enum: enumValues } = config;

            // Type validation
            if (type === "string" && typeof value !== "string") {
              errors.push(`Field ${field} must be a string`);
            } else if (type === "number" && typeof value !== "number") {
              errors.push(`Field ${field} must be a number`);
            } else if (type === "boolean" && typeof value !== "boolean") {
              errors.push(`Field ${field} must be a boolean`);
            } else if (type === "array" && !Array.isArray(value)) {
              errors.push(`Field ${field} must be an array`);
            } else if (
              type === "object" &&
              (typeof value !== "object" || Array.isArray(value))
            ) {
              errors.push(`Field ${field} must be an object`);
            }

            // String validations
            if (type === "string" && typeof value === "string") {
              if (min !== undefined && value.length < min) {
                errors.push(
                  `Field ${field} must be at least ${min} characters`,
                );
              }
              if (max !== undefined && value.length > max) {
                errors.push(`Field ${field} must be at most ${max} characters`);
              }
              if (pattern && !new RegExp(pattern).test(value)) {
                errors.push(`Field ${field} does not match required pattern`);
              }
            }

            // Number validations
            if (type === "number" && typeof value === "number") {
              if (min !== undefined && value < min) {
                errors.push(`Field ${field} must be at least ${min}`);
              }
              if (max !== undefined && value > max) {
                errors.push(`Field ${field} must be at most ${max}`);
              }
            }

            // Enum validation
            if (enumValues && !enumValues.includes(value)) {
              errors.push(
                `Field ${field} must be one of: ${enumValues.join(", ")}`,
              );
            }
          }
        }
      }

      if (errors.length > 0) {
        const { response } = createErrorResponse(
          "Validation failed",
          400,
          errors.join("; "),
        );
        return res.status(400).json(response);
      }

      next();
    } catch (error) {
      logger.error("Validation middleware error:", error);
      const { response } = createErrorResponse("Validation error", 500);
      res.status(500).json(response);
    }
  };
}

/**
 * Validate query parameters
 * @param {Object} schema - Validation schema
 * @returns {Function} Express middleware
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    try {
      const { query } = req;
      const errors = [];

      if (schema.required) {
        for (const field of schema.required) {
          if (query[field] === undefined || query[field] === null) {
            errors.push(`Missing required query parameter: ${field}`);
          }
        }
      }

      if (schema.properties) {
        for (const [field, config] of Object.entries(schema.properties)) {
          if (query[field] !== undefined) {
            const value = query[field];
            const { type, min, max, enum: enumValues } = config;

            // Type validation
            if (type === "number") {
              const numValue = Number(value);
              if (isNaN(numValue)) {
                errors.push(`Query parameter ${field} must be a number`);
              } else {
                if (min !== undefined && numValue < min) {
                  errors.push(
                    `Query parameter ${field} must be at least ${min}`,
                  );
                }
                if (max !== undefined && numValue > max) {
                  errors.push(
                    `Query parameter ${field} must be at most ${max}`,
                  );
                }
              }
            }

            if (enumValues && !enumValues.includes(value)) {
              errors.push(
                `Query parameter ${field} must be one of: ${enumValues.join(", ")}`,
              );
            }
          }
        }
      }

      if (errors.length > 0) {
        const { response } = createErrorResponse(
          "Query validation failed",
          400,
          errors.join("; "),
        );
        return res.status(400).json(response);
      }

      next();
    } catch (error) {
      logger.error("Query validation middleware error:", error);
      const { response } = createErrorResponse("Validation error", 500);
      res.status(500).json(response);
    }
  };
}

/**
 * Validate URL parameters
 * @param {Object} schema - Validation schema
 * @returns {Function} Express middleware
 */
export function validateParams(schema) {
  return (req, res, next) => {
    try {
      const { params } = req;
      const errors = [];

      if (schema.required) {
        for (const field of schema.required) {
          if (!params[field]) {
            errors.push(`Missing required parameter: ${field}`);
          }
        }
      }

      if (schema.properties) {
        for (const [field, config] of Object.entries(schema.properties)) {
          if (params[field]) {
            const value = params[field];
            const { type, pattern } = config;

            if (type === "number") {
              const numValue = Number(value);
              if (isNaN(numValue)) {
                errors.push(`Parameter ${field} must be a number`);
              }
            }

            if (pattern && !new RegExp(pattern).test(value)) {
              errors.push(`Parameter ${field} does not match required pattern`);
            }
          }
        }
      }

      if (errors.length > 0) {
        const { response } = createErrorResponse(
          "Parameter validation failed",
          400,
          errors.join("; "),
        );
        return res.status(400).json(response);
      }

      next();
    } catch (error) {
      logger.error("Parameter validation middleware error:", error);
      const { response } = createErrorResponse("Validation error", 500);
      res.status(500).json(response);
    }
  };
}
