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
│   ├── cors.js             # CORS middleware
│   ├── requestLogger.js    # Request logging middleware
│   └── errorHandler.js     # Error handling middleware
└── routes/
    ├── health.js           # Health check routes
    ├── webhook.js          # Webhook routes
    └── api.js              # General API routes
```

## Features

- **Unified Server**: Single Express.js server handling all HTTP endpoints
- **Modular Design**: Clean separation of concerns with dedicated modules
- **Health Checks**: Basic and Docker-specific health monitoring
- **Webhook Support**: Ko-fi webhook handling with token verification
- **CORS Support**: Cross-origin resource sharing for external API access
- **Request Logging**: Detailed request/response logging for debugging
- **Error Handling**: Centralized error handling with proper logging
- **Configuration Management**: Environment-based configuration with validation

## Endpoints

### Health Checks

- `GET /health` - Basic health check
- `GET /health/docker` - Docker-specific health check

### Webhooks

- `GET /webhook/test` - Test webhook endpoint (GET)
- `POST /webhook/test` - Test webhook endpoint (POST)
- `POST /webhook/verify` - Webhook token verification
- `POST /webhook/kofi` - Ko-fi webhook handler

### API

- `GET /api/status` - API status information
- `GET /api/info` - Detailed API information

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
KOFI_WEBHOOK_TOKEN=your_token   # Ko-fi webhook token
WEBHOOK_VERIFICATION=true       # Enable webhook verification (default: true)
```

## Usage

```javascript
import { startWebhookServer } from "./server/index.js";

// Start the server
const server = startWebhookServer();
```

## Development

### Adding New Routes

1. Create a new route handler in the appropriate file in `routes/`
2. Import and register the route in `webhookServer.js`
3. Add documentation to this README

### Adding New Middleware

1. Create a new middleware file in `middleware/`
2. Import and register the middleware in `webhookServer.js`
3. Update configuration in `config/serverConfig.js` if needed

### Testing

The server can be tested using curl or any HTTP client:

```bash
# Health check
curl http://localhost:3000/health

# API status
curl http://localhost:3000/api/status

# Test webhook
curl http://localhost:3000/webhook/test
```

## Error Handling

All errors are handled centrally by the error handling middleware. Errors are logged with full context and appropriate HTTP status codes are returned.

## Logging

The server uses the centralized logger from `utils/logger.js`. Request logging can be disabled by setting `REQUEST_LOGGING=false` in the environment.
