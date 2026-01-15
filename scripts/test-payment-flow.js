#!/usr/bin/env node
/**
 * Payment Flow Test Script
 * Tests the complete payment flow from webhook to Core crediting
 * 
 * Usage:
 *   PLISIO_SECRET_KEY=your_key node scripts/test-payment-flow.js
 * 
 * Options:
 *   TEST_USER_ID=discord_id   Your Discord user ID
 *   API_BASE=http://...       API base URL (default: http://localhost:3030)
 *   TEST_AMOUNT=10            Amount to test (default: 10)
 */

import crypto from 'crypto';

const API_BASE = process.env.API_BASE || 'http://localhost:3030';
const PLISIO_SECRET_KEY = process.env.PLISIO_SECRET_KEY;
const TEST_USER_ID = process.env.TEST_USER_ID || '639696408592777227';
const TEST_AMOUNT = parseFloat(process.env.TEST_AMOUNT || '10');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(emoji, message, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

async function testPaymentFlow() {
  console.log('\n' + '='.repeat(60));
  log('🧪', 'PAYMENT FLOW TEST', colors.cyan);
  console.log('='.repeat(60) + '\n');

  log('📍', `API Base: ${API_BASE}`, colors.blue);
  log('👤', `Test User: ${TEST_USER_ID}`, colors.blue);
  log('💵', `Test Amount: $${TEST_AMOUNT}`, colors.blue);
  console.log('');

  if (!PLISIO_SECRET_KEY) {
    log('❌', 'PLISIO_SECRET_KEY environment variable required', colors.red);
    console.log('\nUsage:');
    console.log('  PLISIO_SECRET_KEY=your_key node scripts/test-payment-flow.js');
    process.exit(1);
  }

  try {
    // Step 1: Test API health
    log('1️⃣', 'Testing API health...');
    let response = await fetch(`${API_BASE}/health`);
    if (!response.ok) {
      log('❌', `API not healthy: ${response.status}`, colors.red);
      process.exit(1);
    }
    log('✅', 'API is healthy', colors.green);
    console.log('');

    // Step 2: Check initial balance
    log('2️⃣', 'Checking initial balance...');
    response = await fetch(`${API_BASE}/api/user/${TEST_USER_ID}/balance`);
    let data = await response.json();
    const initialCredits = data.data?.credits || 0;
    log('📊', `Initial credits: ${initialCredits} Cores`, colors.blue);
    console.log('');

    // Step 3: Create test webhook payload
    log('3️⃣', 'Creating test webhook payload...');
    const orderNumber = `${TEST_USER_ID}_${Date.now()}`;

    const webhookData = {
      status: 'completed',
      order_number: orderNumber,
      amount: '0.00010551',
      currency: 'BTC',
      source_amount: TEST_AMOUNT.toString(),
      source_currency: 'USD',
      email: 'test@example.com',
      txn_id: 'test_' + Date.now()
    };

    // Generate verify_hash (Plisio's signature algorithm)
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

    log('📝', `Order Number: ${orderNumber}`, colors.blue);
    log('💵', `Amount: $${TEST_AMOUNT} USD`, colors.blue);
    console.log('');

    // Step 4: Send webhook
    log('4️⃣', 'Sending webhook to /webhook/crypto...');
    response = await fetch(`${API_BASE}/webhook/crypto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookData)
    });

    data = await response.json();
    console.log(`   Response: ${JSON.stringify(data)}`);

    if (!data.received) {
      log('❌', 'Webhook was not received!', colors.red);
      process.exit(1);
    }

    if (!data.processed) {
      log('⚠️', 'Webhook received but not processed (check bot logs)', colors.yellow);
    } else {
      log('✅', `Webhook processed: ${data.type}`, colors.green);
    }
    console.log('');

    // Step 5: Wait for processing
    log('5️⃣', 'Waiting for processing (1s)...');
    await new Promise(resolve => {
      setTimeout(resolve, 1000);
    });
    console.log('');

    // Step 6: Check new balance
    log('6️⃣', 'Checking new balance...');
    response = await fetch(`${API_BASE}/api/user/${TEST_USER_ID}/balance`);
    data = await response.json();
    const newCredits = data.data?.credits || 0;
    const addedCredits = newCredits - initialCredits;

    log('📊', `New credits: ${newCredits} Cores`, colors.blue);
    log('➕', `Added: +${addedCredits} Cores`, addedCredits > 0 ? colors.green : colors.yellow);
    console.log('');

    // Step 7: Check payment history
    log('7️⃣', 'Checking payment history...');
    response = await fetch(`${API_BASE}/api/user/${TEST_USER_ID}/payments`);
    data = await response.json();
    
    const payments = data.data?.payments || [];
    const recentPayment = payments.find(p => 
      p.chargeId === orderNumber || p.paymentId === orderNumber
    );

    if (recentPayment) {
      log('✅', 'Payment found in history!', colors.green);
      console.log(`   Provider: ${recentPayment.provider}`);
      console.log(`   Amount: $${recentPayment.amount}`);
      console.log(`   Cores: ${recentPayment.cores || recentPayment.coresGranted}`);
    } else {
      log('ℹ️', `Total payments for user: ${payments.length}`, colors.blue);
    }
    console.log('');

    // Final Summary
    console.log('='.repeat(60));
    log('📊', 'TEST SUMMARY', colors.cyan);
    console.log('='.repeat(60) + '\n');

    if (addedCredits > 0) {
      log('✅', 'SUCCESS! Payment flow is working correctly.', colors.green);
      console.log(`   User ${TEST_USER_ID} received ${addedCredits} Cores.\n`);
    } else if (data.processed === false) {
      log('⚠️', 'Payment not processed - check signature or status', colors.yellow);
      console.log('   Check the bot logs for errors.\n');
    } else {
      log('⚠️', 'No credits added - may be duplicate detection', colors.yellow);
      console.log('   If testing again, a new order_number is needed.\n');
    }

    log('💡', 'Next steps:', colors.blue);
    console.log('   1. Test with a real Plisio sandbox payment');
    console.log('   2. Verify /core balance command in Discord');
    console.log('   3. Set up production webhook URL in Plisio dashboard');
    console.log('');

  } catch (error) {
    log('❌', `Test failed: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testPaymentFlow();
