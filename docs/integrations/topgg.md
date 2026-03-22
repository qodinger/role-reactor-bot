# Voting System Setup

Guide for integrating top.gg voting rewards. Users earn **1 Core Credit** per vote every 12 hours.

## 🚀 Quick Start

### 1. Get Your top.gg Token

1. Go to your bot's page on [top.gg](https://top.gg/bot/1392714201558159431)
2. Click **"Manage Bot"** → **"Webhook"** section
3. Copy the **Authorization Token**

### 2. Add Token to Environment

```env
TOPGG_WEBHOOK_AUTH=your_topgg_authorization_token_here
```

### 3. Configure Webhook URL on top.gg

Set the webhook URL in your top.gg bot dashboard:

```
https://your-domain.com/webhook/topgg
```

For local testing with ngrok:

```bash
ngrok http 3000
# Use: https://your-ngrok-url.ngrok.io/webhook/topgg
```

### 4. Deploy and Restart

```bash
pnpm run deploy:dev
pnpm start
```

## 🧪 Testing

### Test the Command

Run `/vote` in Discord. You should see:
- Vote link to top.gg
- Reward information (1 Core per vote)
- Cooldown info (12 hours)

### Test the Webhook

```bash
curl -X POST https://your-bot-url.com/webhook/topgg \
  -H "Authorization: Bearer YOUR_TOPGG_WEBHOOK_AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "user": "YOUR_DISCORD_USER_ID",
    "username": "TestUser",
    "discriminator": "0001",
    "type": "vote"
  }'
```

**Expected response:**

```json
{
  "success": true,
  "message": "Vote processed successfully",
  "reward": 1
}
```

**Verify:** You should receive a DM from the bot, your Core balance should increase by 1, and bot logs should show `✅ top.gg: Rewarded [user-id] with 1 Core`.

## 🎯 How It Works

```
User votes on top.gg
  → top.gg sends POST to /webhook/topgg
  → Bot verifies token
  → Bot checks 12h cooldown
  → Bot adds 1 Core to user's balance
  → Bot sends thank you DM
  → Bot logs the vote
```

## 🔧 Troubleshooting

### Webhook Not Receiving Votes

1. Verify `TOPGG_WEBHOOK_AUTH` is set in `.env`
2. Confirm webhook URL is correct in top.gg dashboard
3. Ensure your server is publicly accessible
4. Check bot logs for errors

### Users Not Receiving Core

1. Check database connection is working
2. Look for `✅ top.gg: Rewarded...` in logs
3. Verify user ID in webhook payload

```javascript
// Manual check in MongoDB
db.credits.findOne({ userId: "USER_ID" })
```

### Users Not Receiving DM

This is normal if the user has DMs disabled or blocked the bot. Core is still awarded even if the DM fails.

## 📊 Monitoring

### Vote Statistics

```javascript
db.credits.aggregate([
  { $match: { lastVote: { $exists: true } } },
  { $group: { _id: null, totalVoters: { $sum: 1 }, totalVotes: { $sum: "$totalVotes" } } }
])
```

### Recent Votes

```javascript
db.credits.find(
  { lastVote: { $exists: true } },
  { userId: 1, totalVotes: 1, lastVote: 1 }
).sort({ lastVote: -1 }).limit(10)
```

## 🔐 Security

- Token is verified on every webhook request
- Rate limiting prevents spam
- 12-hour cooldown enforced server-side
- Only valid Discord user IDs accepted

## 📝 Environment Variables

```env
# Required
TOPGG_WEBHOOK_AUTH=your_topgg_authorization_token

# Optional
VOTE_REWARD_AMOUNT=1           # Core reward per vote (default: 1)
VOTE_COOLDOWN_MS=43200000      # Cooldown in ms (default: 12 hours)
```

## ✅ Setup Checklist

- [ ] Added `TOPGG_WEBHOOK_AUTH` to `.env`
- [ ] Configured webhook URL on top.gg
- [ ] Deployed bot with `/vote` command
- [ ] Tested webhook manually
- [ ] Verified Core rewards working
- [ ] Checked logs for errors
