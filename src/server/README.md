# Server Module

This module contains the unified API server for the Role Reactor Discord Bot. It provides a clean, organized structure for handling all HTTP endpoints including health checks, webhooks, and general API functionality.

## Structure

```
src/server/
├── index.js                 # Main exports
├── webhookServer.js         # Main server setup and initialization
├── config/
│   └── serverConfig.js      # Server configuration and validation
├── middleware/
│   ├── authentication.js    # Authentication and authorization middleware
│   ├── cors.js             # CORS middleware
│   ├── errorHandler.js     # Error handling middleware
│   ├── rateLimiter.js      # Rate limiting middleware
│   ├── requestId.js        # Request ID tracking middleware
│   ├── requestLogger.js    # Request logging middleware
│   └── validation.js       # Request validation middleware
├── routes/
│   ├── api.js              # General API routes
│   ├── auth.js             # Authentication routes (Discord OAuth)
│   ├── docs.js             # API documentation routes (Swagger/OpenAPI)
│   ├── health.js           # Health check routes
│   ├── services.js         # Service discovery routes
│   └── webhook.js          # Webhook routes
├── services/
│   ├── BaseService.js      # Base service class for all API services
│   ├── ServiceRegistry.js  # Service registry for dynamic discovery
│   ├── payments/           # Payments service
│   ├── supporters/         # Supporters service
│   └── example/            # Example service implementation
└── utils/
    ├── openapiGenerator.js # OpenAPI specification generator
    ├── pagination.js       # Pagination utilities
    ├── responseHelpers.js  # Response formatting utilities
    └── serviceLoader.js    # Service loading utilities
```

## Features

- **Unified Server**: Single Express.js server handling all HTTP endpoints
- **Service-Based Architecture**: Modern BaseService pattern with ServiceRegistry for dynamic service discovery
- **Auto-Documentation**: OpenAPI/Swagger documentation that automatically updates when services change
- **Modular Design**: Clean separation of concerns with dedicated modules
- **Health Checks**: Comprehensive health monitoring including service and database checks
- **Webhook Support**: Crypto payment webhook handling with token verification
- **CORS Support**: Cross-origin resource sharing for external API access
- **Request Logging**: Detailed request/response logging with request ID tracking
- **Error Handling**: Centralized error handling with proper logging and consistent response format
- **Rate Limiting**: Configurable rate limiting for different endpoint types
- **Input Validation**: Request validation middleware for bodies, queries, and params
- **Authentication**: Discord OAuth integration with session management
- **Configuration Management**: Environment-based configuration with validation

## Endpoints

### Health Checks

- `GET /health` - Comprehensive health check (server, services, database)
- `GET /health/docker` - Docker-specific health check

### Webhooks

- `POST /webhook/verify` - Webhook token verification
- `POST /webhook/crypto` - Crypto payment webhook handler

### API

- `GET /api/info` - API information
- `GET /api/stats` - Bot statistics
- `GET /api/services` - List all registered services
- `GET /api/services/:name` - Get service by name

### API Documentation

- `GET /api/docs` - Interactive Swagger UI
- `GET /api/docs/openapi.json` - OpenAPI 3.0 specification (JSON)

### Authentication

- `GET /auth/discord` - Initiate Discord OAuth flow
- `GET /auth/discord/callback` - Discord OAuth callback
- `POST /auth/logout` - Logout user

### Services

- `GET /api/payments/*` - Payments service endpoints
- `GET /api/supporters/*` - Supporters service endpoints

## Service Architecture

### BaseService

All API services extend the `BaseService` class, which provides:

- Automatic route registration
- Common middleware setup
- Error handling
- Response formatting
- Health check endpoints
- Request ID tracking

**Example Service:**

```javascript
import { BaseService } from "./services/BaseService.js";
import { requireAuth } from "./middleware/authentication.js";
import { validateBody } from "./middleware/validation.js";

export class MyService extends BaseService {
  constructor() {
    super({
      name: "my-service",
      version: "v1",
      basePath: "/api/my-service",
      metadata: {
        description: "My service description",
        version: "1.0.0",
      },
    });
    this.setupRoutes();
  }

  setupRoutes() {
    // Public endpoint
    this.get("/items", this.asyncHandler(this.handleGetItems.bind(this)));

    // Protected endpoint
    this.post(
      "/items",
      requireAuth,
      validateBody({
        required: ["name"],
        properties: {
          name: { type: "string", min: 1 },
        },
      }),
      this.asyncHandler(this.handleCreateItem.bind(this)),
    );
  }

  async handleGetItems(req, res) {
    const items = [];
    this.sendSuccess(res, { items });
  }

  async handleCreateItem(req, res) {
    const { name } = req.body;
    // Create item logic
    this.sendSuccess(res, { item: { name } });
  }

  // Optional: Custom health check
  async getHealthStatus() {
    const baseStatus = await super.getHealthStatus();
    // Add custom health checks
    return baseStatus;
  }
}
```

### ServiceRegistry

The `ServiceRegistry` manages all registered services and provides:

- Service registration and discovery
- Service metadata
- Route group management
- Service health status aggregation

**Registering a Service:**

```javascript
import { serviceRegistry } from "./services/ServiceRegistry.js";

const myService = new MyService();
serviceRegistry.registerService(myService.getRegistrationInfo());
```

## Configuration

The server can be configured using environment variables:

```bash
# Server configuration
API_PORT=3030                    # Server port (default: 3030)
NODE_ENV=development             # Environment (development/production)

# CORS configuration
CORS_ORIGIN=*                   # CORS origin (default: *)

# Logging configuration
REQUEST_LOGGING=true            # Enable request logging (default: true)
LOG_LEVEL=info                  # Log level (default: info)

# Health check configuration
HEALTH_CHECKS=true              # Enable health checks (default: true)
DOCKER_HEALTH_CHECK=true        # Enable Docker health check (default: true)

# Webhook configuration
WEBHOOK_TOKEN=your_token   # Webhook verification token
WEBHOOK_VERIFICATION=true       # Enable webhook verification (default: true)

# Rate limiting
API_RATE_LIMIT_MAX=60           # API rate limit (default: 60 per 15min)
API_RATE_LIMIT_WINDOW_MS=900000 # Rate limit window (default: 15min)
WEBHOOK_RATE_LIMIT_MAX=100      # Webhook rate limit (default: 100 per 15min)

# Authentication
DISCORD_CLIENT_ID=your_id       # Discord OAuth client ID
DISCORD_CLIENT_SECRET=your_secret # Discord OAuth client secret
SESSION_SECRET=your_secret      # Session secret for cookies

# Services
COINBASE_ENABLED=true           # Enable payments service
```

## Usage

```javascript
import { startWebhookServer } from "./server/index.js";

// Start the server
const server = await startWebhookServer();
```

## Development

### Adding New Services

1. Create a new service class extending `BaseService`
2. Implement `setupRoutes()` method
3. Register the service in `webhookServer.js`:

```javascript
const myService = new MyService();
serviceRegistry.registerService(myService.getRegistrationInfo());
```

The service will be automatically:

- Registered with the service registry
- Added to API documentation
- Included in health checks
- Available via service discovery

### Adding New Routes

For services extending `BaseService`, add routes in `setupRoutes()`:

```javascript
this.get("/path", handler);
this.post("/path", middleware, handler);
```

For standalone routes, create a route file in `routes/` and register in `webhookServer.js`.

### Adding New Middleware

1. Create a new middleware file in `middleware/`
2. Import and register in `webhookServer.js` `initializeMiddleware()`
3. Update configuration in `config/serverConfig.js` if needed

### Testing

The server can be tested using curl or any HTTP client:

```bash
# Health check
curl http://localhost:3030/health

# API info
curl http://localhost:3030/api/info

# API documentation
curl http://localhost:3030/api/docs/openapi.json

# Service discovery
curl http://localhost:3030/api/services
```

## Error Handling

All errors are handled centrally by the error handling middleware. Errors are:

- Logged with full context (request ID, URL, method, IP, user agent)
- Returned with consistent format using `createErrorResponse` helper
- Sanitized in production (no stack traces exposed)
- Include request ID for tracing

## Logging

The server uses the centralized logger from `utils/logger.js`. Request logging includes:

- Request ID for tracing
- Method and URL
- IP address and user agent
- Response status and timing
- Error details (if applicable)

Request logging can be disabled by setting `REQUEST_LOGGING=false` in the environment.

## Security

### Rate Limiting

Different rate limits for different endpoint types:

- **API endpoints**: 60 requests per 15 minutes (default)
- **Webhook endpoints**: 100 requests per 15 minutes (default)

### Authentication

- Discord OAuth integration for user authentication
- Session-based authentication with secure cookies
- Permission-based authorization with `requirePermission` middleware

### Input Validation

- Request body validation using Joi schemas
- Query parameter validation
- Path parameter validation
- Automatic error responses for invalid input

### Request Security

- Request body size limits (10MB)
- Request timeout (30 seconds)
- CORS protection
- Rate limiting
- Request ID tracking for security auditing

## API Documentation

The server automatically generates OpenAPI 3.0 documentation from registered services:

- **Interactive UI**: Visit `/api/docs` for Swagger UI
- **OpenAPI Spec**: Get JSON spec at `/api/docs/openapi.json`
- **Auto-updates**: Documentation updates automatically when services change

See `API_DOCUMENTATION.md` for more details.

## Performance

- Request timeout: 30 seconds
- Body size limit: 10MB
- Rate limiting to prevent abuse
- Efficient service discovery
- Request ID tracking for observability

## Troubleshooting

### Port Already in Use

The server will automatically find an available port if the configured port is in use. Check logs for the actual port used.

### Services Not Appearing in Documentation

Ensure services are:

1. Registered with `serviceRegistry.registerService()`
2. Routes are registered using `this.get()`, `this.post()`, etc.
3. Service extends `BaseService`

### Authentication Not Working

Check:

1. `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are set
2. `SESSION_SECRET` is configured
3. OAuth redirect URI matches Discord app settings

### Rate Limiting Issues

Adjust rate limits via environment variables:

- `API_RATE_LIMIT_MAX`
- `WEBHOOK_RATE_LIMIT_MAX`
