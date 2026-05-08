/**
 * Request validation middleware
 * Provides common validation utilities for API routes
 */

import { getLogger } from "../../utils/logger.js";
import { createErrorResponse } from "../utils/responseHelpers.js";
import {
  InputSanitizer,
  InputValidator,
} from "../../utils/validation/inputValidation.js";

const logger = getLogger();

/**
 * Validate request body against schema with enhanced security
 * @param {Object} schema - Validation schema
 * @returns {Function} Express middleware
 */
export function validateBody(schema) {
  return (req, res, next) => {
    try {
      const { body } = req;
      const errors = [];
      req.sanitizedBody = {};

      // Validate required fields
      if (schema.required) {
        for (const field of schema.required) {
          if (
            body[field] === undefined ||
            body[field] === null ||
            body[field] === ""
          ) {
            errors.push(`Missing required field: ${field}`);
          }
        }
      }

      // Validate field types
      if (schema.properties) {
        for (const [field, config] of Object.entries(schema.properties)) {
          if (body[field] !== undefined && body[field] !== null) {
            const value = body[field];
            const {
              type,
              min,
              max,
              pattern,
              enum: enumValues,
              email,
              noHtml,
              sanitize,
            } = config;

            // Check for malicious content in string inputs
            if (
              (type === "string" || typeof value === "string") &&
              email !== true &&
              noHtml !== false
            ) {
              if (InputValidator.containsMaliciousContent(value)) {
                errors.push(
                  `Field ${field} contains disallowed HTML or script content`,
                );
                continue;
              }
            }

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
              let sanitizedValue = value;

              // Apply sanitization
              if (sanitize !== false) {
                sanitizedValue = InputSanitizer.sanitize(sanitizedValue);
              }

              // Email validation
              if (email === true) {
                const emailError = InputValidator.validateEmail(
                  sanitizedValue,
                  field,
                );
                if (emailError) {
                  errors.push(emailError.message);
                  continue;
                }
                sanitizedValue = sanitizedValue.trim().toLowerCase();
              }

              if (min !== undefined && sanitizedValue.length < min) {
                errors.push(
                  `Field ${field} must be at least ${min} characters`,
                );
              }
              if (max !== undefined && sanitizedValue.length > max) {
                errors.push(`Field ${field} must be at most ${max} characters`);
              }
              if (pattern && !new RegExp(pattern).test(sanitizedValue)) {
                errors.push(`Field ${field} does not match required pattern`);
              }

              // Store sanitized value
              req.sanitizedBody[field] = sanitizedValue;
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

            // For non-string types, copy as-is
            if (type !== "string") {
              req.sanitizedBody[field] = value;
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

      // Replace body with sanitized version
      Object.assign(req.body, req.sanitizedBody);
      next();
    } catch (error) {
      logger.error("Validation middleware error:", error);
      const { response } = createErrorResponse("Validation error", 500);
      res.status(500).json(response);
    }
  };
}

/**
 * Validate query parameters with sanitization
 * @param {Object} schema - Validation schema
 * @returns {Function} Express middleware
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    try {
      const { query } = req;
      const errors = [];
      req.sanitizedQuery = {};

      if (schema.required) {
        for (const field of schema.required) {
          if (
            query[field] === undefined ||
            query[field] === null ||
            query[field] === ""
          ) {
            errors.push(`Missing required query parameter: ${field}`);
          }
        }
      }

      if (schema.properties) {
        for (const [field, config] of Object.entries(schema.properties)) {
          if (query[field] !== undefined) {
            const value = query[field];
            const { type, min, max, enum: enumValues, sanitize } = config;

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
                req.sanitizedQuery[field] = numValue;
              }
            } else if (type === "string") {
              let sanitizedValue = String(value);
              if (sanitize !== false) {
                sanitizedValue = InputSanitizer.sanitize(sanitizedValue);
              }
              if (
                config.maxLength &&
                sanitizedValue.length > config.maxLength
              ) {
                errors.push(
                  `Query parameter ${field} must be at most ${config.maxLength} characters`,
                );
              }
              req.sanitizedQuery[field] = sanitizedValue;
            } else {
              req.sanitizedQuery[field] = value;
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

      Object.assign(req.query, req.sanitizedQuery);
      next();
    } catch (error) {
      logger.error("Query validation middleware error:", error);
      const { response } = createErrorResponse("Validation error", 500);
      res.status(500).json(response);
    }
  };
}

/**
 * Validate URL parameters with sanitization
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

            // Sanitize string params
            if (type === "string" && typeof value === "string") {
              params[field] = InputSanitizer.sanitize(value);
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
