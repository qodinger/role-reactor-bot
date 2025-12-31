/**
 * OpenAPI Specification Generator
 * Dynamically generates OpenAPI 3.0 specification from service registry
 */

import { serviceRegistry } from "../services/ServiceRegistry.js";

/**
 * Generate OpenAPI 3.0 specification
 * @param {Object} options - Generation options
 * @param {string} options.title - API title
 * @param {string} options.version - API version
 * @param {string} options.description - API description
 * @param {string} options.serverUrl - Server base URL
 * @returns {Object} OpenAPI 3.0 specification
 */
export function generateOpenAPISpec(options = {}) {
  const {
    title = "Role Reactor API",
    version = "1.0.0",
    description = "API documentation for Role Reactor Discord Bot",
    serverUrl = process.env.BOT_URL || "http://localhost:3030",
  } = options;

  const spec = {
    openapi: "3.0.0",
    info: {
      title,
      version,
      description,
      contact: {
        name: "Role Reactor Support",
        url: "https://rolereactor.app",
      },
    },
    servers: [
      {
        url: serverUrl,
        description: "Production server",
      },
    ],
    paths: {},
    components: {
      schemas: {
        SuccessResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "success",
            },
            data: {
              type: "object",
            },
            timestamp: {
              type: "string",
              format: "date-time",
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "error",
            },
            message: {
              type: "string",
            },
            hint: {
              type: "string",
              nullable: true,
            },
            requestId: {
              type: "string",
            },
            timestamp: {
              type: "string",
              format: "date-time",
            },
          },
        },
        HealthStatus: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["healthy", "degraded", "unhealthy"],
            },
            service: {
              type: "string",
            },
            version: {
              type: "string",
            },
            timestamp: {
              type: "string",
              format: "date-time",
            },
            checks: {
              type: "object",
            },
          },
        },
      },
      securitySchemes: {
        sessionAuth: {
          type: "apiKey",
          in: "cookie",
          name: "connect.sid",
          description: "Discord OAuth session cookie",
        },
      },
    },
    tags: [],
  };

  // Add service routes
  const services = serviceRegistry.getAllServices();
  const routeGroups = serviceRegistry.getAllRouteGroups();

  // Process BaseService instances
  for (const service of services) {
    const tag = {
      name: service.name,
      description: service.metadata?.description || `${service.name} service`,
    };
    if (!spec.tags.find(t => t.name === tag.name)) {
      spec.tags.push(tag);
    }

    // Extract routes from service router
    const routes = extractRoutesFromService(service);
    for (const route of routes) {
      const routePath = route.path === "/" ? "" : route.path;
      const fullPath = `${service.basePath}${routePath}`;

      // Normalize path (remove trailing slashes, handle root)
      let normalizedPath =
        fullPath === service.basePath
          ? service.basePath
          : fullPath.replace(/\/$/, "") || service.basePath;

      // Convert Express path params (:param) to OpenAPI format ({param})
      normalizedPath = normalizedPath.replace(/:(\w+)/g, "{$1}");

      if (!spec.paths[normalizedPath]) {
        spec.paths[normalizedPath] = {};
      }

      const operation = createOperation(route, service);
      spec.paths[normalizedPath][route.method.toLowerCase()] = operation;
    }
  }

  // Add route group routes (auth, webhooks, etc.)
  // getAllRouteGroups returns an array, so we iterate directly
  for (const group of routeGroups) {
    const name = group.name || "unknown";
    // Normalize tag name (capitalize first letter)
    const tagName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    const tag = {
      name: tagName,
      description: `${tagName} routes`,
    };
    // Check for case-insensitive duplicates
    if (!spec.tags.find(t => t.name.toLowerCase() === tag.name.toLowerCase())) {
      spec.tags.push(tag);
    }

    // For route groups, we'll document common endpoints
    if (name.toLowerCase() === "auth") {
      addAuthRoutes(spec, group.path);
    }
  }

  // Add core API routes
  addCoreRoutes(spec);
  addWebhookRoutes(spec);
  addHealthRoutes(spec);

  return spec;
}

/**
 * Extract routes from a service instance
 * @param {Object} service - Service instance
 * @returns {Array} Array of route definitions
 */
function extractRoutesFromService(service) {
  const routes = [];
  const router = service.router;

  // Walk through router stack to extract routes
  if (router && router.stack) {
    for (const layer of router.stack) {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods);
        for (const method of methods) {
          routes.push({
            method: method.toUpperCase(),
            path: layer.route.path,
            handlers: layer.route.stack,
          });
        }
      }
    }
  }

  return routes;
}

/**
 * Create OpenAPI operation from route
 * @param {Object} route - Route definition
 * @param {Object} service - Service instance
 * @returns {Object} OpenAPI operation
 */
function createOperation(route, service) {
  const path = route.path || "";
  const cleanPath = path.replace(/\/$/, "") || "/";

  // Generate operation ID
  const operationId = `${service.name}_${route.method.toLowerCase()}_${
    cleanPath
      .replace(/^\//, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/^_|_$/g, "") || "root"
  }`;

  // Generate summary from path
  const summary = generateSummary(route.method, cleanPath, service.name);

  const operation = {
    tags: [service.name],
    summary,
    operationId,
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/SuccessResponse",
            },
          },
        },
      },
      400: {
        description: "Bad Request",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
          },
        },
      },
      500: {
        description: "Internal Server Error",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
          },
        },
      },
    },
  };

  // Check if route requires authentication
  const requiresAuth = route.handlers?.some(
    handler =>
      handler.name === "requireAuth" ||
      handler.toString().includes("requireAuth"),
  );

  if (requiresAuth) {
    operation.security = [{ sessionAuth: [] }];
  }

  // Add request body for POST/PUT/PATCH
  if (["POST", "PUT", "PATCH"].includes(route.method)) {
    const requestBody = inferRequestBody(route, service);
    if (requestBody) {
      operation.requestBody = requestBody;
    }
  }

  // Add path parameters
  const pathParams = extractPathParams(cleanPath);
  if (pathParams.length > 0) {
    operation.parameters = pathParams.map(param => ({
      name: param,
      in: "path",
      required: true,
      schema: {
        type: "string",
      },
      description: `The ${param} parameter`,
    }));
  }

  // Add query parameters for GET
  if (route.method === "GET") {
    if (!operation.parameters) {
      operation.parameters = [];
    }

    // Service-specific query parameters
    if (service.name === "supporters" && cleanPath.includes("leaderboard")) {
      operation.parameters.push(
        {
          name: "page",
          in: "query",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            default: 1,
          },
          description: "Page number for pagination",
        },
        {
          name: "limit",
          in: "query",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 20,
          },
          description: "Number of items per page",
        },
        {
          name: "offset",
          in: "query",
          required: false,
          schema: {
            type: "integer",
            minimum: 0,
            default: 0,
          },
          description: "Offset for pagination",
        },
      );
    }
  }

  return operation;
}

/**
 * Generate summary from route information
 * @param {string} method - HTTP method
 * @param {string} path - Route path
 * @param {string} serviceName - Service name
 * @returns {string} Summary text
 */
function generateSummary(method, path, serviceName) {
  const cleanPath = path.replace(/^\//, "").replace(/\/$/, "") || "";

  if (cleanPath === "health") {
    return "Get service health status";
  }

  const action =
    method === "GET"
      ? "Get"
      : method === "POST"
        ? "Create"
        : method === "PUT"
          ? "Update"
          : method === "DELETE"
            ? "Delete"
            : "Process";

  if (cleanPath === "" || cleanPath === serviceName) {
    return `${action} ${serviceName} items`;
  }

  // Extract resource name (first part of path, before any params or sub-paths)
  const resource = cleanPath
    .replace(/\/.*$/, "")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, l => l.toUpperCase());

  // Handle specific common patterns
  if (cleanPath === "create") {
    return "Create new item";
  }

  if (cleanPath === "history") {
    return "Get payment history";
  }

  if (cleanPath === "leaderboard") {
    return "Get leaderboard";
  }

  if (cleanPath.includes("status") || cleanPath.includes(":")) {
    return `${action} ${resource} by ID`;
  }

  return `${action} ${resource}`;
}

/**
 * Infer request body schema from route
 * @param {Object} route - Route definition
 * @param {Object} service - Service instance
 * @returns {Object|null} Request body schema
 */
function inferRequestBody(route, service) {
  const schema = {
    type: "object",
    properties: {},
    required: [],
  };

  // Service-specific schemas
  if (service.name === "payments" && route.path === "/create") {
    schema.properties = {
      type: {
        type: "string",
        enum: ["donation"],
        description: "Payment type",
      },
      amount: {
        type: "number",
        minimum: 5,
        description: "Payment amount in USD",
      },
      tier: {
        type: "string",
        nullable: true,
        description: "Subscription tier (if applicable)",
      },
    };
    schema.required = ["type"];
  }

  return {
    required: schema.required.length > 0,
    content: {
      "application/json": {
        schema,
      },
    },
  };
}

/**
 * Extract path parameters from route path
 * @param {string} path - Route path
 * @returns {Array} Array of parameter names
 */
function extractPathParams(path) {
  const params = [];
  const matches = path.matchAll(/:(\w+)/g);
  for (const match of matches) {
    params.push(match[1]);
  }
  return params;
}

/**
 * Add core API routes to spec
 * @param {Object} spec - OpenAPI specification
 */
function addCoreRoutes(spec) {
  if (!spec.tags.find(t => t.name === "Core")) {
    spec.tags.push({ name: "Core", description: "Core API endpoints" });
  }

  spec.paths["/api/info"] = {
    get: {
      tags: ["Core"],
      summary: "Get API information",
      operationId: "getApiInfo",
      responses: {
        200: {
          description: "API information",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/SuccessResponse",
              },
            },
          },
        },
      },
    },
  };

  spec.paths["/api/stats"] = {
    get: {
      tags: ["Core"],
      summary: "Get bot statistics",
      operationId: "getApiStats",
      responses: {
        200: {
          description: "Bot statistics",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/SuccessResponse",
              },
            },
          },
        },
      },
    },
  };

  spec.paths["/api/services"] = {
    get: {
      tags: ["Core"],
      summary: "List all registered services",
      operationId: "getServices",
      responses: {
        200: {
          description: "List of services",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/SuccessResponse",
              },
            },
          },
        },
      },
    },
  };

  spec.paths["/api/services/{name}"] = {
    get: {
      tags: ["Core"],
      summary: "Get service by name",
      operationId: "getService",
      parameters: [
        {
          name: "name",
          in: "path",
          required: true,
          schema: {
            type: "string",
          },
        },
        {
          name: "version",
          in: "query",
          required: false,
          schema: {
            type: "string",
            default: "v1",
          },
        },
      ],
      responses: {
        200: {
          description: "Service information",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/SuccessResponse",
              },
            },
          },
        },
        404: {
          description: "Service not found",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ErrorResponse",
              },
            },
          },
        },
      },
    },
  };
}

/**
 * Add webhook routes to spec
 * @param {Object} spec - OpenAPI specification
 */
function addWebhookRoutes(spec) {
  if (!spec.tags.find(t => t.name === "Webhooks")) {
    spec.tags.push({ name: "Webhooks", description: "Webhook endpoints" });
  }

  spec.paths["/webhook/verify"] = {
    post: {
      tags: ["Webhooks"],
      summary: "Verify webhook token",
      operationId: "verifyWebhook",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                token: {
                  type: "string",
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Verification result",
        },
      },
    },
  };

  spec.paths["/webhook/kofi"] = {
    post: {
      tags: ["Webhooks"],
      summary: "Ko-fi webhook handler",
      operationId: "kofiWebhook",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
            },
          },
        },
      },
      responses: {
        200: {
          description: "Webhook processed",
        },
      },
    },
  };

  spec.paths["/webhook/crypto"] = {
    post: {
      tags: ["Webhooks"],
      summary: "Crypto payment webhook handler",
      operationId: "cryptoWebhook",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
            },
          },
        },
      },
      responses: {
        200: {
          description: "Webhook processed",
        },
      },
    },
  };

  spec.paths["/webhook/bmac"] = {
    post: {
      tags: ["Webhooks"],
      summary: "Buy Me a Coffee webhook handler",
      operationId: "bmacWebhook",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
            },
          },
        },
      },
      responses: {
        200: {
          description: "Webhook processed",
        },
      },
    },
  };
}

/**
 * Add health check routes to spec
 * @param {Object} spec - OpenAPI specification
 */
function addHealthRoutes(spec) {
  if (!spec.tags.find(t => t.name === "Health")) {
    spec.tags.push({ name: "Health", description: "Health check endpoints" });
  }

  spec.paths["/health"] = {
    get: {
      tags: ["Health"],
      summary: "Server health check",
      operationId: "healthCheck",
      responses: {
        200: {
          description: "Server is healthy",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/HealthStatus",
              },
            },
          },
        },
      },
    },
  };

  spec.paths["/health/docker"] = {
    get: {
      tags: ["Health"],
      summary: "Docker health check",
      operationId: "dockerHealthCheck",
      responses: {
        200: {
          description: "Docker health status",
        },
      },
    },
  };
}

/**
 * Add auth routes to spec
 * @param {Object} spec - OpenAPI specification
 * @param {string} basePath - Base path for auth routes
 */
function addAuthRoutes(spec, basePath) {
  // Check for case-insensitive duplicates
  if (!spec.tags.find(t => t.name.toLowerCase() === "auth")) {
    spec.tags.push({ name: "Auth", description: "Authentication endpoints" });
  }

  spec.paths[`${basePath}/discord`] = {
    get: {
      tags: ["Auth"],
      summary: "Initiate Discord OAuth flow",
      operationId: "discordAuth",
      responses: {
        302: {
          description: "Redirect to Discord OAuth",
        },
      },
    },
  };

  spec.paths[`${basePath}/discord/callback`] = {
    get: {
      tags: ["Auth"],
      summary: "Discord OAuth callback",
      operationId: "discordCallback",
      parameters: [
        {
          name: "code",
          in: "query",
          required: true,
          schema: {
            type: "string",
          },
        },
        {
          name: "state",
          in: "query",
          required: true,
          schema: {
            type: "string",
          },
        },
      ],
      responses: {
        200: {
          description: "Authentication successful",
        },
        400: {
          description: "Authentication failed",
        },
      },
    },
  };

  spec.paths[`${basePath}/logout`] = {
    post: {
      tags: ["Auth"],
      summary: "Logout user",
      operationId: "logout",
      security: [{ sessionAuth: [] }],
      responses: {
        200: {
          description: "Logout successful",
        },
      },
    },
  };
}
