# Automated Ko-fi Integration Setup Guide

## 🎯 Overview

This guide shows you how to automatically detect Ko-fi donations and subscriptions without manual checking. Choose the method that works best for your setup.

## 🔧 **Method 1: Ko-fi Webhooks (Recommended)**

### **How It Works:**

- Ko-fi sends webhooks to your bot when donations/subscriptions occur
- Bot automatically processes credits and Core memberships
- Users include their Discord ID in donation messages

### **Setup Steps:**

#### **1. Deploy Webhook Server**

```bash
# Add to your main bot file (src/index.js)
import { startWebhookServer } from './src/server/webhookServer.js';

// Start webhook server alongside Discord bot
startWebhookServer();
```

#### **2. Configure Ko-fi Webhooks**

1. Go to [Ko-fi Settings > Webhooks](https://ko-fi.com/manage/webhooks)
2. Add webhook URL: `https://your-domain.com/webhook/kofi`
3. Select events: "Donation received", "Subscription started", "Subscription cancelled"
4. Copy webhook secret (if provided)

#### **3. User Instructions**

Tell users to include their Discord ID in donation messages:

```
Donation message: "Discord: 123456789012345678"
```

#### **4. Email Linking (Optional)**

Users can link their email for subscription detection:

```
/ai-avatar-register ko-fi-username:yourusername email:your@email.com
```

### **Advantages:**

- ✅ Fully automated
- ✅ Real-time processing
- ✅ No manual work required
- ✅ Handles both donations and subscriptions

### **Requirements:**

- Public webhook URL (ngrok, VPS, or cloud hosting)
- Ko-fi Pro account (for webhooks)

---

## 🔧 **Method 2: User Registration System**

### **How It Works:**

- Users register their Ko-fi username with the bot
- Bot tracks donations by username
- Manual verification for complex cases

### **Setup Steps:**

#### **1. Deploy Registration Command**

The `/ai-avatar-register` command is already created.

#### **2. User Registration Process**

1. Users run: `/ai-avatar-register ko-fi-username:yourusername`
2. Users make donations on Ko-fi
3. Include Discord ID in donation message
4. Bot processes automatically

#### **3. Admin Verification**

Use `/ai-avatar-verify` for manual verification when needed.

### **Advantages:**

- ✅ No webhook server needed
- ✅ Works with any Ko-fi account
- ✅ Fallback to manual verification
- ✅ User-friendly registration

### **Requirements:**

- Users must register their Ko-fi username
- Users must include Discord ID in donations

---

## 🔧 **Method 3: Manual Verification System**

### **How It Works:**

- Admins manually verify donations using Discord commands
- Users provide proof of donation
- Admins add credits using verification commands

### **Setup Steps:**

#### **1. Deploy Verification Command**

The `/ai-avatar-verify` command is already created.

#### **2. Verification Process**

1. User makes donation on Ko-fi
2. User provides proof (screenshot, URL, etc.)
3. Admin runs: `/ai-avatar-verify user:@user type:donation amount:5.00`
4. Credits are automatically added

### **Advantages:**

- ✅ No technical setup required
- ✅ Works with any payment method
- ✅ Full control over verification
- ✅ Can handle special cases

### **Requirements:**

- Active admin monitoring
- Manual verification process
- Users must provide proof

---

## 🚀 **Recommended Implementation**

### **For Small Servers (< 100 users):**

Use **Method 3 (Manual Verification)**

- Simple to set up
- No technical requirements
- Full control over credits

### **For Medium Servers (100-500 users):**

Use **Method 2 (User Registration)**

- Automated for most cases
- Manual fallback available
- Good balance of automation and control

### **For Large Servers (500+ users):**

Use **Method 1 (Ko-fi Webhooks)**

- Fully automated
- Handles high volume
- Requires technical setup

---

## 📊 **Implementation Comparison**

| Method           | Setup Complexity | Automation Level | Technical Requirements | Best For       |
| ---------------- | ---------------- | ---------------- | ---------------------- | -------------- |
| **Webhooks**     | High             | 100%             | VPS/Cloud hosting      | Large servers  |
| **Registration** | Medium           | 80%              | Basic hosting          | Medium servers |
| **Manual**       | Low              | 0%               | None                   | Small servers  |

---

## 🛠️ **Quick Start (Recommended)**

### **Step 1: Deploy Commands**

```bash
npm run deploy:dev
```

### **Step 2: Set Up User Registration**

1. Tell users to run: `/ai-avatar-register ko-fi-username:theirusername`
2. Users include Discord ID in donation messages
3. Bot processes automatically

### **Step 3: Admin Fallback**

1. Use `/ai-avatar-verify` for manual verification
2. Use `/ai-avatar-credits add` for direct credit addition
3. Use `/ai-avatar-credits set-core` for Core memberships

### **Step 4: Monitor and Scale**

1. Monitor donation processing
2. Upgrade to webhooks if needed
3. Add more automation as you grow

---

## 📱 **User Experience**

### **For Users:**

1. **Register**: `/ai-avatar-register ko-fi-username:yourusername`
2. **Donate**: Include "Discord: YOUR_ID" in donation message
3. **Get Credits**: Automatically added to account
4. **Generate**: Use `/ai-avatar` with credits

### **For Admins:**

1. **Monitor**: Check verification logs
2. **Verify**: Use `/ai-avatar-verify` for manual cases
3. **Manage**: Use credit management commands
4. **Scale**: Upgrade to webhooks when needed

---

## 🔍 **Troubleshooting**

### **Common Issues:**

#### **Credits Not Added:**

- Check if user registered their Ko-fi username
- Verify Discord ID is correct in donation message
- Use manual verification as fallback

#### **Core Membership Not Working:**

- Check if subscription was processed
- Verify email linking if using webhooks
- Use manual Core status setting

#### **Webhook Not Working:**

- Check webhook URL is accessible
- Verify Ko-fi webhook configuration
- Check server logs for errors

### **Debug Commands:**

- `/ai-avatar-credits balance` - Check user credits
- `/ai-avatar-credits pricing` - View pricing info
- Check bot logs for processing errors

---

## 🎯 **Success Metrics**

### **Track These:**

- Donations processed automatically
- Manual verifications required
- User registration rate
- Credit addition success rate

### **Goals:**

- 90%+ automatic processing
- < 10% manual verification needed
- High user registration rate
- Low error rate

---

**Choose the method that fits your technical skills and server size. Start simple and upgrade as you grow!** 🚀
