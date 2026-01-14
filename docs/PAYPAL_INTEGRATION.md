# PayPal Integration Guide

This guide explains how to integrate PayPal payments for purchasing Cores on your separate website.

## Overview

The Role Reactor Bot server provides a webhook endpoint at `/webhook/paypal` that receives PayPal webhook events. When a payment is completed, the server automatically credits the user's Discord account with Cores.

## Setup

### 1. PayPal Developer Account

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Log in or create an account
3. Go to **Apps & Credentials**
4. Click **Create App** (use Sandbox first for testing)
5. Note your **Client ID** and **Client Secret**

### 2. Configure Webhook

In the PayPal Developer Dashboard:

1. Go to your app settings
2. Scroll to **Webhooks**
3. Click **Add Webhook**
4. Set the URL to: `https://your-server.com/webhook/paypal`
5. Subscribe to these events:
   - `CHECKOUT.ORDER.COMPLETED`
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.REFUNDED`
   - `PAYMENT.CAPTURE.PENDING`
   - `PAYMENT.SALE.COMPLETED`
   - `PAYMENT.SALE.DENIED`
   - `PAYMENT.SALE.REFUNDED`
   - `PAYMENT.SALE.PENDING`
6. Note the **Webhook ID** after creation

### 3. Environment Variables

Add these to your `.env` file:

```env
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_WEBHOOK_ID=your_webhook_id
PAYPAL_MODE=sandbox  # or "live" for production
PAYPAL_ENABLED=true
```

## API Endpoints for Website

The bot server provides these API endpoints for your website integration:

### GET /api/pricing

Returns all Core package pricing information.

**Query Parameters:**
- `user_id` or `discord_id` (optional) - Discord user ID for personalized pricing info

**Example Request:**
```bash
curl https://your-server.com/api/pricing
curl https://your-server.com/api/pricing?user_id=123456789012345678
```

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "packages": [
      {
        "id": "$5",
        "name": "Starter",
        "price": 5,
        "currency": "USD",
        "baseCores": 75,
        "bonusCores": 5,
        "totalCores": 80,
        "valuePerDollar": "16.0 Cores/$1",
        "description": "Perfect for trying AI features",
        "estimatedUsage": "~8,000 chat messages or 38 images",
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
        "valuePerDollar": "16.5 Cores/$1",
        "description": "Most popular choice for regular users",
        "estimatedUsage": "~16,500 chat messages or 78 images",
        "popular": true,
        "features": []
      }
    ],
    "minimumPayment": 3,
    "currency": "USD",
    "paymentMethods": {
      "paypal": true,
      "crypto": false
    },
    "promotions": [
      {
        "name": "First Purchase Bonus",
        "type": "first_purchase",
        "bonus": "25%",
        "maxBonus": 50,
        "description": "Get 25% bonus Cores on your first purchase (up to 50 bonus Cores)"
      }
    ],
    "referralSystem": {
      "enabled": true,
      "referrerBonus": "15%",
      "refereeBonus": "10%",
      "minimumPurchase": 10
    },
    "user": {
      "userId": "123456789012345678",
      "isFirstPurchase": true,
      "currentCredits": 0,
      "eligibleForFirstPurchaseBonus": true
    }
  }
}
```

### GET /api/user/:userId/balance

Returns a user's Core balance and payment history.

**URL Parameters:**
- `userId` - Discord user ID

**Alternative:**
- `GET /api/balance?user_id=123456789012345678`

**Example Request:**
```bash
curl https://your-server.com/api/user/123456789012345678/balance
```

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "userId": "123456789012345678",
    "credits": 165,
    "totalGenerated": 165,
    "hasAccount": true,
    "lastUpdated": "2026-01-14T01:30:00.000Z",
    "paymentHistory": {
      "paypal": 1,
      "crypto": 0
    }
  }
}
```

## Website Integration

### Creating Orders

When a user purchases Cores on your website, create a PayPal order with the Discord user ID in the `custom_id` field. This is **critical** for the bot to know which user to credit.

#### Option 1: Simple Format (Recommended)

Set `custom_id` to the Discord user ID:

```javascript
// PayPal Orders API v2
const orderPayload = {
  intent: "CAPTURE",
  purchase_units: [
    {
      amount: {
        currency_code: "USD",
        value: "10.00"
      },
      description: "Core Package - Basic ($10)",
      custom_id: "123456789012345678", // Discord User ID
      // OR with tier info:
      // custom_id: "123456789012345678:$10"
    }
  ]
};
```

#### Option 2: JSON Format (More Data)

For more complex data, use JSON in `custom_id`:

```javascript
const orderPayload = {
  intent: "CAPTURE",
  purchase_units: [
    {
      amount: {
        currency_code: "USD",
        value: "10.00"
      },
      description: "Core Package - Basic ($10)",
      custom_id: JSON.stringify({
        discord_user_id: "123456789012345678",
        tier: "$10",
        package: "Basic"
      })
    }
  ]
};
```

### PayPal JavaScript SDK Example

```html
<!-- Load PayPal SDK -->
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_CLIENT_ID"></script>

<div id="paypal-button-container"></div>

<script>
  // Discord user ID from your auth system
  const discordUserId = "123456789012345678";
  const packageAmount = "10.00";
  const packageTier = "$10";

  paypal.Buttons({
    createOrder: function(data, actions) {
      return actions.order.create({
        purchase_units: [{
          amount: {
            value: packageAmount
          },
          description: `Core Package - ${packageTier}`,
          custom_id: JSON.stringify({
            discord_user_id: discordUserId,
            tier: packageTier
          })
        }]
      });
    },
    onApprove: function(data, actions) {
      return actions.order.capture().then(function(details) {
        // Payment completed!
        // The webhook will automatically credit the user's account
        alert('Thank you for your purchase! Cores will be added to your account shortly.');
      });
    },
    onError: function(err) {
      console.error('PayPal error:', err);
      alert('An error occurred with your payment.');
    }
  }).render('#paypal-button-container');
</script>
```

### Server-Side Order Creation (Node.js)

For more control, create orders on your server:

```javascript
import fetch from 'node-fetch';

// Get PayPal access token
async function getPayPalAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(
    `https://api-m${process.env.PAYPAL_MODE === 'sandbox' ? '.sandbox' : ''}.paypal.com/v1/oauth2/token`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    }
  );

  const data = await response.json();
  return data.access_token;
}

// Create PayPal order
async function createPayPalOrder(discordUserId, amount, tier) {
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(
    `https://api-m${process.env.PAYPAL_MODE === 'sandbox' ? '.sandbox' : ''}.paypal.com/v2/checkout/orders`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: amount
          },
          description: `Core Package - ${tier}`,
          custom_id: JSON.stringify({
            discord_user_id: discordUserId,
            tier: tier
          })
        }]
      })
    }
  );

  return await response.json();
}
```

## Core Pricing Packages

The bot automatically calculates Cores based on the payment amount and these packages:

| Package | Price | Base Cores | Bonus | Total Cores | Rate |
|---------|-------|------------|-------|-------------|------|
| Starter | $5 | 75 | +5 | 80 | 16.0/$ |
| Basic | $10 | 150 | +15 | 165 | 16.5/$ |
| Pro | $25 | 375 | +50 | 425 | 17.0/$ |
| Ultimate | $50 | 750 | +125 | 875 | 17.5/$ |

Payments between tiers use the highest applicable tier rate:
- $5-9.99 → Starter rate
- $10-24.99 → Basic rate
- $25-49.99 → Pro rate
- $50+ → Ultimate rate

Minimum payment: **$3**

## Email Mapping

If a Discord user ID is not provided in `custom_id`, the system will try to match the PayPal email to a Discord account using stored email mappings. However, for reliable crediting, **always include the Discord user ID**.

## Testing with Sandbox

1. Set `PAYPAL_MODE=sandbox` in your `.env`
2. Use sandbox credentials from PayPal Developer Dashboard
3. Create sandbox buyer/seller accounts for testing
4. Test the full flow before going live

## Webhook Events

The server handles these PayPal events:

| Event | Action |
|-------|--------|
| `CHECKOUT.ORDER.COMPLETED` | Credits Cores to user |
| `PAYMENT.CAPTURE.COMPLETED` | Credits Cores to user |
| `PAYMENT.CAPTURE.PENDING` | Logs pending status |
| `PAYMENT.CAPTURE.DENIED` | Logs failure |
| `PAYMENT.CAPTURE.REFUNDED` | Logs refund (future: deduct Cores) |

## Troubleshooting

### User Didn't Receive Cores

1. Check server logs for the webhook event
2. Verify the `custom_id` contains the correct Discord user ID
3. Look for pending payments: `pending_paypal_payments` in storage
4. Use `/core-management add` to manually credit if needed

### Webhook Not Receiving Events

1. Verify webhook URL is accessible from internet
2. Check PayPal Developer Dashboard for webhook delivery status
3. Ensure `PAYPAL_WEBHOOK_ID` matches your webhook configuration

### Duplicate Payment Prevention

The system tracks all processed payments in `userData.paypalPayments`. If the same `paymentId` is received twice, it will be ignored.

## Security Notes

### Webhook Signature Verification

The bot uses **PayPal's official webhook signature verification API** to ensure all webhook events are authentic. This prevents attackers from spoofing payment events.

**How it works:**

1. PayPal sends webhook with cryptographic headers:
   - `paypal-transmission-id` - Unique transmission ID
   - `paypal-transmission-time` - Timestamp
   - `paypal-cert-url` - Certificate URL for verification
   - `paypal-auth-algo` - Algorithm used (e.g., SHA256withRSA)
   - `paypal-transmission-sig` - Digital signature

2. Our server calls PayPal's `POST /v1/notifications/verify-webhook-signature` API
3. PayPal cryptographically verifies the signature and returns `SUCCESS` or `FAILURE`

**Requirements for production:**

- `PAYPAL_CLIENT_ID` - Required for API authentication
- `PAYPAL_CLIENT_SECRET` - Required for API authentication  
- `PAYPAL_WEBHOOK_ID` - Required for signature verification

**Development mode:**

In development (`NODE_ENV !== "production"`), verification is optional if credentials aren't configured. This allows testing without full PayPal setup.

### Additional Security Best Practices

1. **HTTPS Required** - Always use HTTPS for your webhook endpoint
2. **Keep Secrets Secure** - Never expose `PAYPAL_CLIENT_SECRET` in client-side code
3. **Rate Limiting** - The webhook endpoint is protected by rate limiting
4. **Validate Amounts** - Your website should validate that payment amounts match expected package prices
5. **Duplicate Prevention** - All processed payments are tracked to prevent double-crediting

### Environment Variables Summary

| Variable | Required (Production) | Description |
|----------|----------------------|-------------|
| `PAYPAL_CLIENT_ID` | ✅ Yes | PayPal REST API Client ID |
| `PAYPAL_CLIENT_SECRET` | ✅ Yes | PayPal REST API Client Secret |
| `PAYPAL_WEBHOOK_ID` | ✅ Yes | Webhook ID for signature verification |
| `PAYPAL_MODE` | Optional | `sandbox` or `live` (default: `sandbox`) |
| `PAYPAL_ENABLED` | Optional | Set to `true` to enable PayPal payments |

### Access Token Caching

The bot caches PayPal access tokens to minimize API calls. Tokens are refreshed automatically 60 seconds before expiration.
