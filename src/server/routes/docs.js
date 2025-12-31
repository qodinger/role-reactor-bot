/**
 * API Documentation Routes
 * Provides OpenAPI/Swagger documentation endpoints
 */

import { getLogger } from "../../utils/logger.js";
import { generateOpenAPISpec } from "../utils/openapiGenerator.js";
import {
  createErrorResponse,
  logRequest as logRequestHelper,
} from "../utils/responseHelpers.js";

const logger = getLogger();

/**
 * Get OpenAPI specification
 * GET /api/docs/openapi.json
 */
export function getOpenAPISpec(req, res) {
  logRequestHelper(logger, "Get OpenAPI spec", req, "📚");

  try {
    const spec = generateOpenAPISpec({
      title: "Role Reactor API",
      version: "1.0.0",
      description:
        "Complete API documentation for Role Reactor Discord Bot. All endpoints are automatically documented from the service registry.",
      serverUrl: process.env.BOT_URL || `http://${req.get("host")}`,
    });

    res.setHeader("Content-Type", "application/json");
    // Pretty print JSON if requested via query parameter
    if (req.query.pretty === "true") {
      res.json(spec);
    } else {
      res.json(spec);
    }
  } catch (error) {
    logger.error("Error generating OpenAPI spec:", error);
    const { statusCode, response } = createErrorResponse(
      "Failed to generate API documentation",
      500,
      null,
      error.message,
    );
    res.status(statusCode).json(response);
  }
}

/**
 * Serve Swagger UI
 * GET /api/docs
 */
export function getSwaggerUI(req, res) {
  logRequestHelper(logger, "Get Swagger UI", req, "📚");

  const swaggerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Role Reactor API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui.css" />
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: "/api/docs/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        tryItOutEnabled: true
      });
    };
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  res.send(swaggerHtml);
}
