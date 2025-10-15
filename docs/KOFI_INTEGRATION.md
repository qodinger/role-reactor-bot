# Ko-fi Integration Guide for AI Avatar Credits

## 🎯 Overview

This guide explains how to integrate Ko-fi donations and subscriptions with your AI Avatar credit system. Users can earn credits through donations or become "Core" members through monthly subscriptions.

## 💰 Credit System

### Core Members (Subscribers)

- **Cost**: $5/month on Ko-fi
- **Benefits**:
  - 1 credit per avatar (50% discount)
  - 50 free credits monthly
  - Priority generation
  - Exclusive features

### Regular Users

- **Cost**: 2 credits per avatar
- **Credit Packages**:
  - 10 credits: $2.50
  - 25 credits: $5.00
  - 50 credits: $9.00
  - 100 credits: $15.00

## 🔧 Ko-fi Setup

### 1. Create Ko-fi Account

1. Go to [ko-fi.com](https://ko-fi.com)
2. Create your account
3. Set up your profile
4. Add your Discord bot information

### 2. Set Up Donation Tiers

```
Tier 1: $2.50 - 10 Credits
Tier 2: $5.00 - 25 Credits
Tier 3: $9.00 - 50 Credits
Tier 4: $15.00 - 100 Credits
```

### 3. Set Up Monthly Subscription

```
Core Membership: $5/month
- 50 free credits monthly
- 1 credit per avatar
- Priority generation
- Exclusive features
```

### 4. Configure Ko-fi Webhooks

1. Go to Ko-fi Settings > Webhooks
2. Add webhook URL: `https://your-bot-domain.com/kofi-webhook`
3. Select events: "Donation received", "Subscription started", "Subscription cancelled"

## 🚀 Bot Integration

### 1. Webhook Handler

Create a webhook endpoint to receive Ko-fi notifications:

```javascript
// webhook/kofi.js
import { getStorageManager } from "../utils/storage/storageManager.js";

export async function handleKoFiWebhook(req, res) {
  const { data } = req.body;

  if (data.type === "Donation") {
    await processDonation(data);
  } else if (data.type === "Subscription") {
    await processSubscription(data);
  }

  res.status(200).send("OK");
}

async function processDonation(data) {
  const storage = getStorageManager();
  const userId = data.discord_user_id; // You'll need to collect this
  const guildId = data.guild_id; // You'll need to collect this
  const amount = data.amount;

  // Calculate credits based on amount
  const credits = Math.floor(amount / 0.25); // $0.25 per credit

  // Add credits to user
  const userData = (await storage.get(
    `ai_avatar_credits_${guildId}_${userId}`,
  )) || {
    credits: 0,
    isCore: false,
    totalGenerated: 0,
  };

  userData.credits += credits;
  await storage.set(`ai_avatar_credits_${guildId}_${userId}`, userData);

  // Send confirmation message to user
  // Implementation depends on your bot setup
}
```

### 2. Credit Management Commands

The bot includes these commands for managing credits:

- `/ai-avatar-credits balance` - Check credit balance
- `/ai-avatar-credits pricing` - View pricing information
- `/ai-avatar-credits add` - Add credits (admin only)
- `/ai-avatar-credits remove` - Remove credits (admin only)
- `/ai-avatar-credits set-core` - Set Core status (admin only)

## 📊 Revenue Projections

### Small Server (100 users)

- 10 Core members: $50/month
- 20 regular users: $100/month
- **Total Revenue: $150/month**

### Medium Server (500 users)

- 50 Core members: $250/month
- 100 regular users: $500/month
- **Total Revenue: $750/month**

### Large Server (1000+ users)

- 100 Core members: $500/month
- 200 regular users: $1000/month
- **Total Revenue: $1500/month**

## 🎯 Marketing Strategy

### 1. Free Trial

- Give new users 2 free credits
- Let them experience the quality
- Show upgrade prompt after trial

### 2. Core Membership Benefits

- Emphasize 50% discount
- Highlight priority generation
- Mention exclusive features

### 3. Credit Packages

- Offer bulk discounts
- Create urgency with limited-time offers
- Show value compared to individual purchases

## 🔧 Technical Implementation

### 1. Database Schema

```javascript
// User credit data structure
{
  credits: number,           // Available credits
  isCore: boolean,          // Core membership status
  totalGenerated: number,   // Total avatars generated
  lastUpdated: string,      // Last update timestamp
  koFiUserId: string,       // Ko-fi user ID (optional)
  subscriptionId: string,   // Ko-fi subscription ID (optional)
}
```

### 2. Credit Calculation

```javascript
// Donation to credits conversion
function calculateCredits(amount) {
  return Math.floor(amount / 0.25); // $0.25 per credit
}

// Core member monthly credits
function getMonthlyCredits() {
  return 50; // 50 free credits per month
}
```

### 3. Usage Tracking

```javascript
// Track avatar generation
async function generateAvatar(userId, guildId) {
  const userData = await getUserData(userId, guildId);
  const creditsNeeded = userData.isCore ? 1 : 2;

  if (userData.credits < creditsNeeded) {
    throw new Error("Insufficient credits");
  }

  // Deduct credits and generate avatar
  userData.credits -= creditsNeeded;
  userData.totalGenerated += 1;
  await saveUserData(userId, guildId, userData);
}
```

## 📱 User Experience

### 1. Credit Balance Display

Users can check their balance with `/ai-avatar-credits balance`:

```
Your Credit Balance
Core Member - You have special benefits!

Available Credits: 25 credits
Core Status: ⭐ Core Member
Avatars Generated: 12 avatars
Credit Cost: 1 credit per avatar
```

### 2. Insufficient Credits

When users don't have enough credits:

```
Insufficient Credits
You need 2 credits to generate an avatar!

Your Status:
• Credits: 1
• Core Member: No
• Cost: 2 credits per avatar

Get Credits:
• Donate on Ko-fi
• Subscribe for Core membership
• Contact an administrator
```

### 3. Success Message

After successful generation:

```
Avatar Generated Successfully!
Here's your unique anime-style avatar!

Credits Used: 1 credit
Remaining Credits: 24 credits
Core Status: ⭐ Core Member
Total Generated: 13 avatars
```

## 🛠️ Setup Checklist

- [ ] Create Ko-fi account
- [ ] Set up donation tiers
- [ ] Configure monthly subscription
- [ ] Set up webhook endpoint
- [ ] Deploy credit management commands
- [ ] Test credit system
- [ ] Create marketing materials
- [ ] Launch to users

## 📞 Support

### For Users

- Use `/ai-avatar-credits balance` to check credits
- Contact administrators for credit issues
- Visit Ko-fi page for purchases

### For Administrators

- Use `/ai-avatar-credits add` to grant credits
- Use `/ai-avatar-credits set-core` to manage Core status
- Monitor usage through logs

## 🎯 Success Metrics

### Track These Numbers

- Credits purchased per month
- Core subscriptions per month
- Avatars generated per user
- Revenue per user
- Conversion rate from free to paid

### Goals

- Month 1: 10 Core members, $50 revenue
- Month 3: 50 Core members, $250 revenue
- Month 6: 100 Core members, $500 revenue

---

**Remember**: Start with a simple implementation and iterate based on user feedback. The key is providing value that justifies the cost while making it easy for users to purchase credits.
