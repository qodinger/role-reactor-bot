# Payment Flow Testing Guide

This guide walks you through testing the complete payment flow from login to receiving Cores.

## Prerequisites

1. **Bot running:** `npm run dev`
2. **ngrok installed:** For webhook testing
3. **Plisio account:** With API key configured
4. **.env.development configured** with all required variables

---

## Step 1: Start Your Services

### Terminal 1 - Start the Bot
```bash
cd /Users/tyecode/dev/projects/discord-bots/role-reactor-bot
npm run dev
```

### Terminal 2 - Start ngrok (for webhook testing)
```bash
ngrok http 3030
```

Copy the **https URL** (e.g., `https://abc123.ngrok.io`)

### Update Environment
Add to `.env.development`:
```env
PUBLIC_URL=https://abc123.ngrok.io
```

Restart the bot after updating.

---

## Step 2: Test Discord OAuth Login

### Option A: Browser Test
1. Open: `http://localhost:3030/auth/discord`
2. Authorize with Discord
3. Should redirect back to `/` or your specified redirect

### Option B: API Test
```bash
# Check if logged in
curl -c cookies.txt -b cookies.txt http://localhost:3030/auth/me

# Expected: 401 if not logged in
# After login: 200 with user data
```

### Verify Session
After logging in via browser, check:
```bash
curl -b cookies.txt http://localhost:3030/auth/me
```

Expected response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "639696408592777227",
      "username": "irisreturn",
      "email": "your@email.com"
    }
  }
}
```

---

## Step 3: Test Pricing Endpoint

```bash
# Public - no auth needed
curl http://localhost:3030/api/pricing

# With user ID for personalized data
curl "http://localhost:3030/api/pricing?user_id=639696408592777227"
```

---

## Step 4: Test Payment Creation

### Via curl (requires session cookies)
```bash
# First login via browser, then:
curl -X POST http://localhost:3030/api/payments/create \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"packageId": "$10", "amount": 10}'
```

### Expected Response:
```json
{
  "success": true,
  "data": {
    "invoiceUrl": "https://plisio.net/invoice/...",
    "orderId": "639696408592777227_1705234567890",
    "amount": 10,
    "currency": "USD",
    "user": {
      "discordId": "639696408592777227",
      "username": "irisreturn",
      "emailPrefilled": true
    }
  }
}
```

### Verify Email is Pre-filled
1. Open the `invoiceUrl` in browser
2. Email field should already be filled with your Discord email!

---

## Step 5: Test Webhook (Simulated Payment)

### Method A: Plisio Test Mode
Plisio has a sandbox/test mode. Use test payments there.

### Method B: Manual Webhook Simulation

Create a test script to simulate a successful Plisio webhook:

```bash
# Create test webhook payload
cat > /tmp/test-plisio-webhook.json << 'EOF'
{
  "status": "completed",
  "order_number": "639696408592777227_1705234567890",
  "amount": "0.00010551",
  "currency": "BTC",
  "source_amount": "10.00",
  "source_currency": "USD",
  "email": "test@example.com",
  "txn_id": "test_txn_123456"
}
EOF
```

### Generate verify_hash for testing

Run this Node.js script to generate a valid test webhook:

```javascript
// test-webhook.js
import crypto from 'crypto';

const PLISIO_SECRET_KEY = process.env.PLISIO_SECRET_KEY || 'your-secret-key';

// Test data - replace with your actual user ID
const testData = {
  status: 'completed',
  order_number: '639696408592777227_' + Date.now(), // Your Discord ID
  amount: '0.00010551',
  currency: 'BTC',
  source_amount: '10.00',
  source_currency: 'USD',
  email: 'test@example.com',
  txn_id: 'test_txn_' + Date.now()
};

// Generate verify_hash
const orderedKeys = Object.keys(testData).sort();
const orderedData = {};
for (const key of orderedKeys) {
  orderedData[key] = testData[key].toString();
}
const dataString = JSON.stringify(orderedData);
const verifyHash = crypto
  .createHmac('sha1', PLISIO_SECRET_KEY)
  .update(dataString)
  .digest('hex');

testData.verify_hash = verifyHash;

console.log('Webhook payload:');
console.log(JSON.stringify(testData, null, 2));

console.log('\nCurl command:');
console.log(`curl -X POST http://localhost:3030/webhook/crypto \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(testData)}'`);
```

Run it:
```bash
PLISIO_SECRET_KEY=your_key node test-webhook.js
```

Then execute the generated curl command.

### Expected Webhook Response:
```json
{
  "received": true,
  "processed": true,
  "type": "Plisio Payment Confirmed"
}
```

### Check Bot Logs:
You should see:
```
💰 Processing Plisio Payment: {...}
✅ Added 165 Cores to user 639696408592777227 (Plisio payment: $10)
```

---

## Step 6: Verify User Received Cores

### Via API:
```bash
curl http://localhost:3030/api/user/639696408592777227/balance
```

Expected:
```json
{
  "success": true,
  "data": {
    "userId": "639696408592777227",
    "credits": 165,
    "hasAccount": true,
    "paymentHistory": {
      "crypto": 1
    }
  }
}
```

### Via Discord Bot:
Use the `/core balance` command in Discord.

### Via Database (if using MongoDB):
```bash
mongosh
use role-reactor-bot
db.storage.find({ key: "core_credit" })
```

---

## Step 7: Check Payment History

```bash
curl http://localhost:3030/api/user/639696408592777227/payments
```

Expected:
```json
{
  "success": true,
  "data": {
    "userId": "639696408592777227",
    "payments": [
      {
        "chargeId": "639696408592777227_1705234567890",
        "type": "payment",
        "amount": 10,
        "currency": "USD",
        "cores": 165,
        "provider": "Plisio",
        "timestamp": "2026-01-14T10:30:00.000Z",
        "processed": true
      }
    ],
    "total": 1
  }
}
```

---

## Complete Test Script

Save this as `scripts/test-payment-flow.js`:

```javascript
#!/usr/bin/env node
/**
 * Payment Flow Test Script
 * Tests the complete payment flow from webhook to Core crediting
 */

import crypto from 'crypto';

const API_BASE = process.env.API_BASE || 'http://localhost:3030';
const PLISIO_SECRET_KEY = process.env.PLISIO_SECRET_KEY;
const TEST_USER_ID = process.env.TEST_USER_ID || '639696408592777227';

if (!PLISIO_SECRET_KEY) {
  console.error('❌ PLISIO_SECRET_KEY environment variable required');
  process.exit(1);
}

async function testPaymentFlow() {
  console.log('🧪 Starting Payment Flow Test\n');
  console.log(`📍 API Base: ${API_BASE}`);
  console.log(`👤 Test User: ${TEST_USER_ID}\n`);

  // Step 1: Check initial balance
  console.log('1️⃣ Checking initial balance...');
  let response = await fetch(`${API_BASE}/api/user/${TEST_USER_ID}/balance`);
  let data = await response.json();
  const initialCredits = data.data?.credits || 0;
  console.log(`   Initial credits: ${initialCredits}\n`);

  // Step 2: Create test webhook payload
  console.log('2️⃣ Creating test webhook payload...');
  const orderNumber = `${TEST_USER_ID}_${Date.now()}`;
  const testAmount = 10;

  const webhookData = {
    status: 'completed',
    order_number: orderNumber,
    amount: '0.00010551',
    currency: 'BTC',
    source_amount: testAmount.toString(),
    source_currency: 'USD',
    email: 'test@example.com',
    txn_id: 'test_' + Date.now()
  };

  // Generate verify_hash
  const orderedKeys = Object.keys(webhookData).sort();
  const orderedData = {};
  for (const key of orderedKeys) {
    orderedData[key] = webhookData[key].toString();
  }
  const dataString = JSON.stringify(orderedData);
  webhookData.verify_hash = crypto
    .createHmac('sha1', PLISIO_SECRET_KEY)
    .update(dataString)
    .digest('hex');

  console.log(`   Order: ${orderNumber}`);
  console.log(`   Amount: $${testAmount}\n`);

  // Step 3: Send webhook
  console.log('3️⃣ Sending webhook to /webhook/crypto...');
  response = await fetch(`${API_BASE}/webhook/crypto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(webhookData)
  });
  data = await response.json();
  console.log(`   Response: ${JSON.stringify(data)}\n`);

  if (!data.processed) {
    console.error('❌ Webhook was not processed!');
    process.exit(1);
  }

  // Step 4: Wait a moment for processing
  console.log('4️⃣ Waiting for processing...');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 5: Check new balance
  console.log('5️⃣ Checking new balance...');
  response = await fetch(`${API_BASE}/api/user/${TEST_USER_ID}/balance`);
  data = await response.json();
  const newCredits = data.data?.credits || 0;
  const addedCredits = newCredits - initialCredits;

  console.log(`   New credits: ${newCredits}`);
  console.log(`   Added: +${addedCredits} Cores\n`);

  // Step 6: Check payment history
  console.log('6️⃣ Checking payment history...');
  response = await fetch(`${API_BASE}/api/user/${TEST_USER_ID}/payments`);
  data = await response.json();
  const recentPayment = data.data?.payments?.find(p => p.chargeId === orderNumber);

  if (recentPayment) {
    console.log('   ✅ Payment found in history!');
    console.log(`   Cores granted: ${recentPayment.cores}`);
  } else {
    console.log('   ⚠️ Payment not found in history (may use different storage)');
  }

  // Final summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  
  if (addedCredits > 0) {
    console.log('✅ SUCCESS! Payment flow is working correctly.');
    console.log(`   User ${TEST_USER_ID} received ${addedCredits} Cores.`);
  } else {
    console.log('⚠️ WARNING: No credits were added.');
    console.log('   Check the bot logs for errors.');
  }

  console.log('\n💡 Next steps:');
  console.log('   1. Test with a real Plisio sandbox payment');
  console.log('   2. Verify /core balance command in Discord');
  console.log('   3. Set up production webhook URL in Plisio dashboard');
}

testPaymentFlow().catch(console.error);
```

Run it:
```bash
PLISIO_SECRET_KEY=your_key TEST_USER_ID=your_discord_id node scripts/test-payment-flow.js
```

---

## Troubleshooting

### Webhook not received
- Check ngrok is running and URL is correct
- Verify PUBLIC_URL in .env matches ngrok URL
- Check Plisio dashboard for webhook delivery status

### Invalid signature error
- Ensure PLISIO_SECRET_KEY matches your Plisio API key
- Check that the key doesn't have extra whitespace

### Cores not added
- Check bot logs for errors
- Verify user ID is valid (17-20 digits)
- Check storage/database connection

### Session not working
- Ensure SESSION_SECRET is set in .env
- Install express-session: `npm install express-session`
- Check cookies are being set (browser dev tools)

### CORS errors
- Add your domain to ALLOWED_ORIGINS in .env
- For local testing, ensure you're accessing via localhost, not 127.0.0.1

---

## Production Checklist

Before going live:

- [ ] Set `PUBLIC_URL` to your production domain
- [ ] Configure Plisio webhook URL to production endpoint
- [ ] Set `NODE_ENV=production`
- [ ] Use secure SESSION_SECRET
- [ ] Enable HTTPS
- [ ] Test with real small payment ($5)
- [ ] Monitor logs for first few transactions

---

## Quick Reference

| What | Command/URL |
|------|-------------|
| Start bot | `npm run dev` |
| Start ngrok | `ngrok http 3030` |
| Login | `http://localhost:3030/auth/discord` |
| Check user | `curl http://localhost:3030/auth/me -b cookies.txt` |
| Get pricing | `curl http://localhost:3030/api/pricing` |
| Check balance | `curl http://localhost:3030/api/user/USER_ID/balance` |
| Test webhook | Run `node scripts/test-payment-flow.js` |
| Bot logs | Check terminal running `npm run dev` |