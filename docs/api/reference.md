# Role Reactor Bot API Documentation

> **Base URL:** `https://your-domain.com` (or `http://localhost:3030` for development)

## Table of Contents

- [Authentication](#authentication)
- [Core API Endpoints](#core-api-endpoints)
  - [Server Info](#get-apiinfo)
  - [Bot Statistics](#get-apistats)
  - [Pricing](#get-apipricing)
- [Payment Endpoints](#payment-endpoints)
  - [Create Payment](#post-apipaymentscreate)
  - [User Balance](#get-apiuseruseridbalance)
  - [User Payments](#get-apiuseruseridpayments)
  - [Payment Stats](#get-apipaymentsstats)
  - [Pending Payments](#get-apipaymentspending)
- [Authentication Endpoints](#authentication-endpoints)
  - [Discord OAuth](#get-authdiscord)
  - [OAuth Callback](#get-authdiscordcallback)
  - [Current User](#get-authme)
  - [Logout](#post-authlogout)
- [Webhook Endpoints](#webhook-endpoints)
- [Response Format](#response-format)
- [Error Codes](#error-codes)

---

## Authentication

Most read endpoints are public. Payment creation and user-specific endpoints require Discord OAuth authentication.

### Session-Based Authentication

1. User initiates login via `GET /auth/discord`
2. After OAuth flow, session cookie is set
3. Include `credentials: 'include'` in fetch requests
4. Session expires after 24 hours

```javascript
// Example authenticated request
fetch("/api/payments/create", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include", // Required for session auth
  body: JSON.stringify({ amount: 10 }),
});
```

---

## Core API Endpoints

### GET `/api/info`

Returns server information and capabilities.

**Authentication:** None required

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Unified API Server Information",
    "server": {
      "name": "Role Reactor Bot API Server",
      "version": "1.5.0",
      "description": "A powerful Discord bot..."
    },
    "features": {
      "webhooks": true,
      "healthChecks": true,
      "cors": true,
      "requestLogging": true,
      "errorHandling": true
    }
  },
  "timestamp": "2026-01-14T10:00:00.000Z"
}
```

---

### GET `/api/stats`

Returns bot statistics including guild and user counts.

**Authentication:** None required

**Response:**

```json
{
  "success": true,
  "data": {
    "bot": {
      "id": "123456789012345678",
      "username": "Role Reactor",
      "tag": "Role Reactor#0001"
    },
    "statistics": {
      "guilds": 150,
      "users": 50000
    }
  },
  "timestamp": "2026-01-14T10:00:00.000Z"
}
```

---

### GET `/api/pricing`

Returns Core credit packages and current promotions.

**Authentication:** None required (optional user_id for personalized data)

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `user_id` | string | Optional. Discord user ID for personalized pricing info |

**Request:**

```
GET /api/pricing?user_id=639696408592777227
```

**Response:**

```json
{
  "success": true,
  "data": {
    "packages": [
      {
        "id": "$1",
        "name": "Test",
        "price": 1,
        "currency": "USD",
        "baseCores": 15,
        "bonusCores": 0,
        "totalCores": 15,
        "rate": 15.0,
        "valuePerDollar": "15.0 Cores/$1",
        "description": "Developer testing package",
        "estimatedUsage": "~300 chat messages or 7 images",
        "popular": false,
        "features": []
      },
      {
        "id": "$5",
        "name": "Starter",
        "price": 5,
        "currency": "USD",
        "baseCores": 75,
        "bonusCores": 0,
        "totalCores": 75,
        "rate": 15.0,
        "valuePerDollar": "15.0 Cores/$1",
        "description": "Perfect for trying AI features",
        "estimatedUsage": "~1,500 chat messages or 35 images",
        "popular": false,
        "features": []
      },
      {
        "id": "$10",
        "name": "Basic",
        "price": 10,
        "currency": "USD",
        "baseCores": 150,
        "bonusCores": 15,
        "totalCores": 165,
        "rate": 16.5,
        "valuePerDollar": "16.5 Cores/$1",
        "description": "Most popular choice for regular users",
        "estimatedUsage": "~3,300 chat messages or 78 images",
        "popular": true,
        "features": []
      },
      {
        "id": "$25",
        "name": "Pro",
        "price": 25,
        "currency": "USD",
        "baseCores": 375,
        "bonusCores": 60,
        "totalCores": 435,
        "rate": 17.4,
        "valuePerDollar": "17.4 Cores/$1",
        "description": "Best value for power users",
        "estimatedUsage": "~8,700 chat messages or 207 images",
        "popular": false,
        "features": []
      },
      {
        "id": "$50",
        "name": "Ultimate",
        "price": 50,
        "currency": "USD",
        "baseCores": 750,
        "bonusCores": 150,
        "totalCores": 900,
        "rate": 18.0,
        "valuePerDollar": "18.0 Cores/$1",
        "description": "Maximum value for heavy usage",
        "estimatedUsage": "~18,000 chat messages or 428 images",
        "popular": false,
        "features": ["Priority processing", "Dedicated support"]
      }
    ],
    "minimumPayment": 3,
    "currency": "USD",
    "paymentMethods": {
      "paypal": true,
      "crypto": true
    },
    "promotions": [
      {
        "name": "First Purchase Bonus",
        "type": "first_purchase",
        "bonus": "25%",
        "maxBonus": 50,
        "description": "Get 25% bonus Cores on your first purchase (up to 50 bonus Cores)"
      },
      {
        "name": "Weekend Special",
        "type": "weekend",
        "bonus": "15%",
        "description": "Weekend special: 15% bonus Cores on all purchases!",
        "active": true
      }
    ],
    "referralSystem": {
      "enabled": true,
      "referrerBonus": "15%",
      "refereeBonus": "10%",
      "minimumPurchase": 10
    },
    "user": {
      "userId": "639696408592777227",
      "isFirstPurchase": true,
      "currentCredits": 0,
      "eligibleForFirstPurchaseBonus": true
    }
  },
  "timestamp": "2026-01-14T10:00:00.000Z"
}
```

---

## Payment Endpoints

### POST `/api/payments/create`

Creates a new payment invoice using Plisio. **Email is automatically pre-filled from Discord OAuth.**

**Authentication:** Required (Discord OAuth session)

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | number | Yes | Payment amount in USD (minimum $1) |
| `packageId` | string | No | Package identifier (e.g., "$10", "$25") |

**Request:**

```json
{
  "packageId": "$10",
  "amount": 10
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "invoiceUrl": "https://plisio.net/invoice/abc123xyz",
    "orderId": "639696408592777227_1705234567890",
    "amount": 10,
    "currency": "USD",
    "packageId": "$10",
    "user": {
      "discordId": "639696408592777227",
      "username": "irisreturn",
      "emailPrefilled": true
    },
    "message": "Payment invoice created successfully. Redirect user to invoiceUrl."
  },
  "timestamp": "2026-01-14T10:00:00.000Z"
}
```

**Error Responses:**

| Status | Error                         | Description                     |
| ------ | ----------------------------- | ------------------------------- |
| 401    | Authentication required       | User not logged in              |
| 400    | Invalid amount                | Amount must be positive number  |
| 400    | Amount too low                | Below minimum payment threshold |
| 500    | Payment system not configured | PLISIO_SECRET_KEY not set       |

**Usage Example:**

```javascript
async function createPayment(packageId, amount) {
  const response = await fetch("/api/payments/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ packageId, amount }),
  });

  const data = await response.json();

  if (data.success) {
    // Redirect to payment page (email pre-filled!)
    window.location.href = data.data.invoiceUrl;
  } else {
    console.error("Payment failed:", data.error);
  }
}
```

---

### GET `/api/user/:userId/balance`

Returns a user's Core credit balance.

**Authentication:** None required

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | string | Discord user ID |

**Alternative:** `GET /api/balance?user_id=:userId`

**Response:**

```json
{
  "success": true,
  "data": {
    "userId": "639696408592777227",
    "credits": 165,
    "totalGenerated": 50,
    "hasAccount": true,
    "lastUpdated": "2026-01-14T09:30:00.000Z",
    "paymentHistory": {
      "paypal": 2,
      "crypto": 1
    }
  },
  "timestamp": "2026-01-14T10:00:00.000Z"
}
```

**New User Response:**

```json
{
  "success": true,
  "data": {
    "userId": "639696408592777227",
    "credits": 0,
    "totalGenerated": 0,
    "hasAccount": false,
    "paymentHistory": {
      "paypal": 0,
      "crypto": 0
    }
  },
  "timestamp": "2026-01-14T10:00:00.000Z"
}
```

---

### GET `/api/user/:userId/payments`

Returns a user's payment history.

**Authentication:** None required

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | string | Discord user ID |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Maximum results to return |
| `skip` | number | 0 | Results to skip (pagination) |
| `provider` | string | null | Filter by provider (paypal, plisio) |

**Alternative:** `GET /api/payments?user_id=:userId`

**Response:**

```json
{
  "success": true,
  "data": {
    "userId": "639696408592777227",
    "payments": [
      {
        "paymentId": "639696408592777227_1705234567890",
        "provider": "plisio",
        "amount": 10,
        "currency": "USD",
        "coresGranted": 165,
        "tier": "$10",
        "status": "completed",
        "createdAt": "2026-01-14T09:00:00.000Z"
      }
    ],
    "total": 1,
    "stats": {
      "totalAmount": 10,
      "totalCores": 165,
      "byProvider": {
        "plisio": 1,
        "paypal": 0
      }
    },
    "pagination": {
      "limit": 50,
      "skip": 0,
      "hasMore": false
    }
  },
  "timestamp": "2026-01-14T10:00:00.000Z"
}
```

---

### GET `/api/payments/stats`

Returns global payment statistics. (Admin endpoint)

**Authentication:** None required (consider adding auth for production)

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `start_date` | string | Optional. ISO date string for range start |
| `end_date` | string | Optional. ISO date string for range end |

**Response:**

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalPayments": 150,
      "totalRevenue": 2500.0,
      "totalCoresGranted": 45000,
      "uniqueCustomers": 85
    },
    "recentPayments": [
      {
        "paymentId": "123456_1705234567890",
        "discordId": "123456789012345678",
        "provider": "plisio",
        "amount": 25,
        "coresGranted": 425,
        "createdAt": "2026-01-14T09:30:00.000Z"
      }
    ],
    "dateRange": {
      "start": null,
      "end": null
    }
  },
  "timestamp": "2026-01-14T10:00:00.000Z"
}
```

---

### GET `/api/payments/pending`

Returns pending payments awaiting processing. (Admin endpoint)

**Authentication:** None required (consider adding auth for production)

**Response:**

```json
{
  "success": true,
  "data": {
    "pending": [
      {
        "paymentId": "abc123",
        "provider": "plisio",
        "amount": 10,
        "currency": "USD",
        "email": "user@example.com",
        "status": "pending",
        "createdAt": "2026-01-14T09:00:00.000Z"
      }
    ],
    "awaitingUserLink": [
      {
        "paymentId": "xyz789",
        "provider": "paypal",
        "amount": 25,
        "email": "unknown@example.com",
        "createdAt": "2026-01-14T08:00:00.000Z"
      }
    ],
    "totals": {
      "pending": 1,
      "awaitingLink": 1
    }
  },
  "timestamp": "2026-01-14T10:00:00.000Z"
}
```

---

## Authentication Endpoints

### GET `/auth/discord`

Initiates Discord OAuth2 login flow.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `redirect` | string | Optional. URL to redirect after login (same-origin only) |

**Response:** Redirects to Discord OAuth authorization page

**Example:**

```
GET /auth/discord?redirect=/pricing
```

---

### GET `/auth/discord/callback`

Handles Discord OAuth2 callback. **Do not call directly.**

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | Authorization code from Discord |
| `state` | string | CSRF protection state |

**Response:** Redirects to specified redirect URL or `/`

---

### GET `/auth/me`

Returns the currently authenticated user's information.

**Authentication:** Required (session cookie)

**Response (Authenticated):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "639696408592777227",
      "username": "irisreturn",
      "discriminator": "0",
      "avatar": "abc123def456",
      "email": "user@example.com"
    }
  },
  "timestamp": "2026-01-14T10:00:00.000Z"
}
```

**Response (Not Authenticated):**

```json
{
  "success": false,
  "error": {
    "message": "Not authenticated",
    "code": 401
  },
  "timestamp": "2026-01-14T10:00:00.000Z"
}
```

---

### POST `/auth/logout`

Logs out the current user and destroys the session.

**Authentication:** Required (session cookie)

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  },
  "timestamp": "2026-01-14T10:00:00.000Z"
}
```

---

## Webhook Endpoints

These endpoints receive payment notifications from payment providers.

### POST `/webhook/crypto`

Receives webhooks from crypto payment providers (Plisio).

**Headers (Provider-specific):**

- Plisio: Body contains `verify_hash`

**Response:** `200 OK` with `{ "received": true }`

---

### POST `/webhook/paypal`

Receives webhooks from PayPal.

**Headers:**

- Various PayPal signature headers for verification

**Response:** `200 OK` with `{ "received": true }`

---

### POST `/webhook/verify`

Verifies webhook token configuration.

**Response:** `200 OK` with verification status

---

## Health Endpoints

### GET `/health`

Returns server health status.

**Response:**

```json
{
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy", "duration": 15 },
    "memory": { "status": "healthy", "heapUsed": "45.2 MB" },
    "discord_api": { "status": "healthy", "ping": "45ms" }
  },
  "timestamp": "2026-01-14T10:00:00.000Z"
}
```

---

## Response Format

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-01-14T10:00:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "message": "Human-readable error message",
    "code": 400,
    "details": "Additional error details (optional)"
  },
  "timestamp": "2026-01-14T10:00:00.000Z"
}
```

---

## Error Codes

| Status Code | Description                            |
| ----------- | -------------------------------------- |
| 200         | Success                                |
| 400         | Bad Request - Invalid parameters       |
| 401         | Unauthorized - Authentication required |
| 403         | Forbidden - Insufficient permissions   |
| 404         | Not Found - Resource doesn't exist     |
| 405         | Method Not Allowed                     |
| 408         | Request Timeout                        |
| 429         | Too Many Requests - Rate limited       |
| 500         | Internal Server Error                  |
| 503         | Service Unavailable                    |

---

## Rate Limiting

API requests are rate-limited to prevent abuse:

- **API endpoints:** 100 requests per minute per IP
- **Webhook endpoints:** 30 requests per minute per IP

When rate limited, you'll receive:

```json
{
  "success": false,
  "error": {
    "message": "Too many requests",
    "code": 429
  },
  "retryAfter": 60
}
```

---

## CORS

The API supports CORS for browser-based requests. Allowed origins are configured via the `ALLOWED_ORIGINS` environment variable.

For session-based authentication, ensure you include `credentials: 'include'` in your fetch requests.

---

## SDK Example (JavaScript)

```javascript
class RoleReactorAPI {
  constructor(baseUrl = "") {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    return response.json();
  }

  // Auth
  async getCurrentUser() {
    return this.request("/auth/me");
  }

  async logout() {
    return this.request("/auth/logout", { method: "POST" });
  }

  // Pricing
  async getPricing(userId = null) {
    const query = userId ? `?user_id=${userId}` : "";
    return this.request(`/api/pricing${query}`);
  }

  // Payments
  async createPayment(amount, packageId = null) {
    return this.request("/api/payments/create", {
      method: "POST",
      body: JSON.stringify({ amount, packageId }),
    });
  }

  async getUserBalance(userId) {
    return this.request(`/api/user/${userId}/balance`);
  }

  async getUserPayments(userId, options = {}) {
    const params = new URLSearchParams(options);
    return this.request(`/api/user/${userId}/payments?${params}`);
  }
}

// Usage
const api = new RoleReactorAPI("https://api.rolereactor.app");

// Get current user
const {
  data: { user },
} = await api.getCurrentUser();

// Create payment
const {
  data: { invoiceUrl },
} = await api.createPayment(10, "$10");
window.location.href = invoiceUrl;
```

---

## Environment Variables

Required configuration for the API server:

```env
# Discord OAuth
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
DISCORD_REDIRECT_URI=https://your-domain.com/auth/discord/callback

# Session
SESSION_SECRET=random_secure_string

# Payments
PLISIO_SECRET_KEY=your_plisio_key
PAYPAL_CLIENT_ID=your_paypal_id
PAYPAL_CLIENT_SECRET=your_paypal_secret

# Server
PUBLIC_URL=https://your-domain.com
API_PORT=3030
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

---

_Last updated: 2026-01-14_
