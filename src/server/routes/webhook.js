import { getLogger } from "../../utils/logger.js";
import { timingSafeEqual } from "crypto";
import {
  createSuccessResponse,
  createErrorResponse,
  logRequest as logRequestHelper,
} from "../utils/responseHelpers.js";

const logger = getLogger();

/**
 * Get webhook token from request
 * @param {import('express').Request} req - Express request object
 * @returns {string|null} Token or null
 */
function getWebhookToken(req) {
  return (
    req.body.token || req.headers["x-webhook-token"] || req.query.token || null
  );
}

/**
 * Webhook token verification endpoint
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export function verifyWebhookToken(req, res) {
  try {
    logRequestHelper(logger, "Webhook verification", req, "🔐");

    // Get the token from request body or headers
    const providedToken = getWebhookToken(req);
    const expectedToken = process.env.WEBHOOK_TOKEN;

    if (!providedToken) {
      logger.warn("❌ No webhook token provided in verification request");
      const { statusCode, response } = createErrorResponse(
        "No webhook token provided",
        400,
        "Provide token via body.token, x-webhook-token header, or ?token query parameter",
      );
      return res.status(statusCode).json(response);
    }

    if (!expectedToken) {
      logger.warn("⚠️ No webhook token configured in environment");
      const { statusCode, response } = createErrorResponse(
        "Webhook token not configured on server",
        500,
        "Set WEBHOOK_TOKEN environment variable",
      );
      return res.status(statusCode).json(response);
    }

    // Verify the token using constant-time comparison to prevent timing attacks
    let isValid = false;
    try {
      if (providedToken.length === expectedToken.length) {
        isValid = timingSafeEqual(
          Buffer.from(providedToken),
          Buffer.from(expectedToken),
        );
      }
    } catch (_error) {
      // If comparison fails (shouldn't happen with same length), treat as invalid
      isValid = false;
    }

    logger.info(
      `🔍 Token verification result: ${isValid ? "VALID" : "INVALID"}`,
      {
        providedTokenLength: providedToken.length,
        expectedTokenLength: expectedToken.length,
        tokenMatch: isValid,
        timestamp: new Date().toISOString(),
      },
    );

    if (isValid) {
      res.json(
        createSuccessResponse({
          message: "Webhook token is valid!",
          verification: {
            tokenProvided: true,
            tokenValid: true,
            tokenLength: providedToken.length,
            serverConfigured: true,
          },
        }),
      );
    } else {
      const { statusCode, response } = createErrorResponse(
        "Invalid webhook token",
        401,
        "Check your webhook token configuration",
      );
      res.status(statusCode).json({
        ...response,
        verification: {
          tokenProvided: true,
          tokenValid: false,
          tokenLength: providedToken.length,
          serverConfigured: true,
        },
      });
    }
  } catch (error) {
    logger.error("❌ Error in webhook verification:", error);
    const { statusCode, response } = createErrorResponse(
      "Internal server error during verification",
      500,
      null,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}
