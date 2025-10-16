# Webhook Verification API

This document describes the webhook verification API endpoint that allows you to test and verify webhook tokens.

## Endpoint

```
POST /webhook/verify
```

## Purpose

The webhook verification API allows you to:

- Test if your webhook token is correctly configured
- Verify token validity before setting up webhooks
- Debug webhook authentication issues
- Validate token format and length

## Authentication

The verification endpoint accepts tokens in three ways:

### 1. Request Body (JSON)

```json
{
  "token": "your-webhook-token-here"
}
```

### 2. HTTP Header

```
x-webhook-token: your-webhook-token-here
```

### 3. Query Parameter

```
POST /webhook/verify?token=your-webhook-token-here
```

## Request Examples

### cURL Examples

**Using request body:**

```bash
curl -X POST https://api.rolereactor.app/webhook/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "your-webhook-token-here"}'
```

**Using header:**

```bash
curl -X POST https://api.rolereactor.app/webhook/verify \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: your-webhook-token-here" \
  -d '{}'
```

**Using query parameter:**

```bash
curl -X POST "https://api.rolereactor.app/webhook/verify?token=your-webhook-token-here" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### JavaScript Example

```javascript
const response = await fetch("https://api.rolereactor.app/webhook/verify", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-webhook-token": "your-webhook-token-here",
  },
  body: JSON.stringify({}),
});

const result = await response.json();
console.log(result);
```

## Response Format

### Success Response (200 OK)

```json
{
  "status": "success",
  "message": "Webhook token is valid!",
  "verification": {
    "tokenProvided": true,
    "tokenValid": true,
    "tokenLength": 36,
    "serverConfigured": true
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Error Responses

#### No Token Provided (400 Bad Request)

```json
{
  "status": "error",
  "message": "No webhook token provided",
  "hint": "Provide token via body.token, x-webhook-token header, or ?token query parameter",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### Invalid Token (401 Unauthorized)

```json
{
  "status": "error",
  "message": "Invalid webhook token",
  "verification": {
    "tokenProvided": true,
    "tokenValid": false,
    "tokenLength": 12,
    "serverConfigured": true
  },
  "hint": "Check your webhook token configuration",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### Server Not Configured (500 Internal Server Error)

```json
{
  "status": "error",
  "message": "Webhook token not configured on server",
  "hint": "Set KOFI_WEBHOOK_TOKEN environment variable",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

## Testing

### Using the Test Script

A test script is provided to verify the API functionality:

```bash
# Test with default settings
pnpm test:webhook-verify

# Test with custom URL
pnpm test:webhook-verify --url https://api.rolereactor.app

# Test with custom token
pnpm test:webhook-verify --token your-actual-token

# Test with both custom URL and token
pnpm test:webhook-verify --url https://api.rolereactor.app --token your-actual-token
```

### Manual Testing

You can also test manually using any HTTP client:

1. **Valid Token Test**: Send your actual webhook token
2. **Invalid Token Test**: Send a fake token to verify error handling
3. **No Token Test**: Send request without any token
4. **Header Test**: Test token via `x-webhook-token` header
5. **Query Test**: Test token via query parameter

## Use Cases

### 1. Pre-deployment Verification

Before setting up webhooks with external services (like Ko-fi), verify your token is correctly configured.

### 2. Debugging Webhook Issues

If webhooks are failing, use this endpoint to verify token configuration.

### 3. Token Rotation

When rotating webhook tokens, verify the new token works before updating webhook configurations.

### 4. Development Testing

During development, ensure your local environment has the correct token configuration.

## Security Notes

- The verification endpoint logs token lengths but not the actual token values
- Tokens are compared using secure string comparison
- Failed verification attempts are logged for monitoring
- The endpoint does not expose sensitive configuration details

## Integration with Ko-fi

This verification endpoint is particularly useful when setting up Ko-fi webhooks:

1. **Get your Ko-fi webhook token** from your Ko-fi account settings
2. **Set the token** in your environment variables (`KOFI_WEBHOOK_TOKEN`)
3. **Verify the token** using this API endpoint
4. **Configure Ko-fi** to send webhooks to your server
5. **Test the webhook** using Ko-fi's test functionality

## Related Endpoints

- `GET /health` - Server health check
- `GET /webhook/test` - Basic webhook functionality test
- `POST /webhook/kofi` - Ko-fi webhook handler
