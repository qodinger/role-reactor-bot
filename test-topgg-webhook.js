/**
 * Test script for top.gg webhook
 * Usage: node test-topgg-webhook.js YOUR_TOPGG_TOKEN YOUR_DISCORD_ID
 */

const WEBHOOK_URL = 'https://cde0-202-137-154-22.ngrok-free.app/webhook/topgg';
const TOPGG_TOKEN = process.argv[2] || 'test_token';
const TEST_USER_ID = process.argv[3] || '123456789012345678'; // Your Discord ID

console.log('🗳️ Testing top.gg Webhook...\n');
console.log('Webhook URL:', WEBHOOK_URL);
console.log('Token:', TOPGG_TOKEN.substring(0, 10) + '...');
console.log('Test User ID:', TEST_USER_ID);
console.log('');

const testVote = {
  user: TEST_USER_ID,
  username: 'TestUser',
  discriminator: '0001',
  type: 'vote',
  query: '',
  bot: '1392714201558159431'
};

async function testWebhook() {
  try {
    console.log('📤 Sending test vote...');
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOPGG_TOKEN}`
      },
      body: JSON.stringify(testVote)
    });

    const data = await response.json();

    console.log('\n📥 Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(data, null, 2));

    if (response.status === 200 && data.success) {
      console.log('\n✅ Webhook test SUCCESSFUL!');
      console.log('✅ Vote processed correctly');
      if (data.reward) {
        console.log(`✅ Reward: ${data.reward} Core Credit(s)`);
      }
    } else if (response.status === 401) {
      console.log('\n❌ Webhook test FAILED - Unauthorized');
      console.log('❌ Check your TOPGG_TOKEN in .env file');
    } else if (response.status === 400) {
      console.log('\n❌ Webhook test FAILED - Bad Request');
      console.log('❌ Check the vote data format');
    } else {
      console.log('\n⚠️ Webhook test returned unexpected status:', response.status);
    }

  } catch (error) {
    console.log('\n❌ Webhook test FAILED - Connection Error');
    console.log('❌ Error:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. Your ngrok tunnel is running');
    console.log('   2. The webhook URL is correct');
    console.log('   3. Your bot is running and listening on /webhook/topgg');
  }
}

testWebhook();
