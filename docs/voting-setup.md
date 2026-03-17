# 🗳️ top.gg Voting System - Setup Guide

## Overview

Users can vote for your bot on top.gg and receive **1 Core Credit** as a reward every 12 hours.

---

## 📋 Setup Steps

### **1. Get Your top.gg Token**

1. Go to your bot's page on top.gg: https://top.gg/bot/1392714201558159431
2. Click **"Manage Bot"** or **"Edit"**
3. Go to **"Webhook"** section
4. Copy the **Authorization Token** (keep this secret!)

---

### **2. Add Token to Environment**

Add this to your `.env` file:

```env
TOPGG_TOKEN=your_topgg_authorization_token_here
```

---

### **3. Configure Webhook URL on top.gg**

In your top.gg bot dashboard:

**Webhook URL:**
```
https://your-bot-url.com/webhook/topgg
```

**If running locally (for testing):**
- Use ngrok: `ngrok http 3000`
- Webhook URL: `https://your-ngrok-url.ngrok.io/webhook/topgg`

**If running in production:**
- Use your actual domain: `https://rolereactor.app/webhook/topgg`
- Or your server IP: `http://your-server-ip:3000/webhook/topgg`

---

### **4. Deploy and Restart**

```bash
# Deploy commands (already done)
pnpm run deploy:dev

# Restart bot to load webhook
pnpm start
```

---

## 🧪 Testing

### **Test the Command**

In Discord:
```
/vote
```

You should see:
- Vote link to top.gg
- Reward information (1 Core per vote)
- Cooldown info (12 hours)

---

### **Test the Webhook (Manual)**

```bash
# Send test vote to your webhook
curl -X POST https://your-bot-url.com/webhook/topgg \
  -H "Authorization: Bearer YOUR_TOPGG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user": "YOUR_DISCORD_USER_ID",
    "username": "TestUser",
    "discriminator": "0001",
    "type": "vote"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Vote processed successfully",
  "reward": 1
}
```

**Check:**
- You should receive a DM from the bot thanking you
- Your Core balance should increase by 1
- Bot logs should show: `✅ top.gg: Rewarded [user-id] with 1 Core`

---

## 🔧 Troubleshooting

### **Webhook Not Receiving Votes**

**Check:**
1. Is `TOPGG_TOKEN` set in `.env`?
2. Is webhook URL correct in top.gg dashboard?
3. Is your bot's server publicly accessible?
4. Check bot logs for errors

**Test webhook endpoint:**
```bash
# Should return 401 without token
curl -X POST https://your-bot-url.com/webhook/topgg

# Should return 200 with valid token
curl -X POST https://your-bot-url.com/webhook/topgg \
  -H "Authorization: Bearer YOUR_TOPGG_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user": "123456"}'
```

---

### **Users Not Receiving Core**

**Check:**
1. Is database connection working?
2. Check logs for: `✅ top.gg: Rewarded...`
3. Verify user ID in webhook payload is correct

**Manual check:**
```javascript
// In MongoDB or your database tool
db.credits.findOne({ userId: "USER_ID" })
// Should show lastVote timestamp and increased balance
```

---

### **Users Not Receiving DM**

This is normal if:
- User has DMs disabled
- User blocked the bot
- Bot can't find the user

**Not critical** - Core is still awarded even if DM fails.

---

## 📊 Monitoring Votes

### **Check Vote Statistics**

```javascript
// In your database
db.credits.aggregate([
  { 
    $match: { lastVote: { $exists: true } } 
  },
  {
    $group: {
      _id: null,
      totalVoters: { $sum: 1 },
      totalVotes: { $sum: "$totalVotes" }
    }
  }
])
```

### **Check Recent Votes**

```javascript
// Last 10 voters
db.credits.find(
  { lastVote: { $exists: true } },
  { userId: 1, totalVotes: 1, lastVote: 1 }
).sort({ lastVote: -1 }).limit(10)
```

---

## 💡 Tips

### **Encourage Voting**

1. **Add `/vote` to help command** - Make it easy to find
2. **Remind users** - "You can vote every 12 hours for 1 Core!"
3. **Show top voters** - Create a leaderboard for most votes
4. **Vote streaks** - Consider bonus for consecutive daily votes (future feature)

### **Security**

- ✅ Token is verified on every webhook
- ✅ Rate limiting prevents spam
- ✅ 12 hour cooldown enforced
- ✅ Only valid Discord user IDs accepted

### **Scaling**

Current setup handles:
- ✅ Up to 1000 votes/hour easily
- ✅ Minimal database impact
- ✅ Cached user lookups

If you get 10,000+ votes/day, consider:
- Increasing cooldown to 24 hours
- Batching Core Credit updates
- Adding vote cache

---

## 🎯 What Happens When Someone Votes

```
1. User clicks vote link on top.gg
   ↓
2. User votes on top.gg
   ↓
3. top.gg sends POST to /webhook/topgg
   ↓
4. Bot verifies token
   ↓
5. Bot checks 12h cooldown
   ↓
6. Bot adds 1 Core to user's balance
   ↓
7. Bot sends thank you DM
   ↓
8. Bot logs the vote
   ↓
9. top.gg receives success response
```

**Total time:** < 1 second

---

## 📝 Environment Variables

```env
# Required for voting system
TOPGG_TOKEN=your_topgg_authorization_token

# Optional: Customize reward amount (default: 1)
VOTE_REWARD_AMOUNT=1

# Optional: Customize cooldown (default: 12 hours in ms)
VOTE_COOLDOWN_MS=43200000
```

---

## 🚀 Future Enhancements

Potential improvements:
- [ ] Vote streak bonuses (7 days = 10 Core bonus)
- [ ] `/vote-stats` command (show total votes, your votes)
- [ ] Top voter leaderboard
- [ ] Vote goals (100 votes = server-wide reward)
- [ ] Custom reward amounts per user tier

---

## ✅ Checklist

- [ ] Added `TOPGG_TOKEN` to `.env`
- [ ] Configured webhook URL on top.gg
- [ ] Deployed bot with `/vote` command
- [ ] Tested webhook manually
- [ ] Verified Core rewards working
- [ ] Checked logs for errors

**All done?** Users can now vote and get Core Credits! 🎉

---

**Support:** If you have issues, check bot logs first, then test webhook manually with curl.
