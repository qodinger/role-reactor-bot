# Customizing Appearance

Learn how to customize the visual appearance of your role messages to match your server's theme and create an engaging experience for your members.

## Message Customization Options

Role Reactor Bot provides several ways to customize how your role messages look and feel. You can control colors, formatting, styling, and visual elements to create professional-looking role selection interfaces.

## Basic Message Components

### Title Customization

The title is the main heading of your role message:

**Simple Titles:**
```
/role create
title: Choose Your Roles
```

**Styled Titles with Emojis:**
```
/role create
title: 🎮 Gaming Preferences 🎮
```

**Themed Titles:**
```
/role create
title: ═══ ⚔️ CHOOSE YOUR CLASS ⚔️ ═══
```

**Professional Titles:**
```
/role create
title: Server Role Selection
```

### Description Formatting

Use Discord markdown formatting in descriptions:

**Basic Description:**
```
description: React below to get your roles!
```

**Formatted Description:**
```
description: **Welcome to our server!**\n\nReact to the emojis below to get your roles.\n\n*Click multiple emojis to get multiple roles.*
```

**Multi-line with Instructions:**
```
description: 🎯 **How to get roles:**\n• Click the emoji for the role you want\n• You can select multiple roles\n• Click again to remove a role\n\n**Available roles:**
```

## Advanced Formatting Techniques

### Using Discord Markdown

**Bold Text:**
```
description: **Important:** Choose your notification preferences carefully!
```

**Italic Text:**
```
description: *Click the reactions below to get your roles*
```

**Code Blocks:**
```
description: Select your programming languages:\n```\nPython | JavaScript | Java | C++\n```
```

**Combined Formatting:**
```
description: **🎮 Gaming Setup**\n\n*Choose your platform preferences below:*\n\n• **PC Gaming** - Access to PC gaming channels\n• **Console Gaming** - PlayStation and Xbox discussions\n• **Mobile Gaming** - Mobile game communities
```

### Line Breaks and Spacing

Use `\n` for line breaks in descriptions:

```
description: Welcome to our gaming community!\n\nChoose your roles below:\n━━━━━━━━━━━━━━━━━━━━━━\n🎮 Platform preferences\n🎯 Gaming style\n🔔 Notification settings
```

### Special Characters and Dividers

**Unicode Dividers:**
```
═══════════════════════
━━━━━━━━━━━━━━━━━━━━━━━
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
・・・・・・・・・・・・・・・・・・・・・
```

**Styled Sections:**
```
description: ╔══════════════════╗\n║     GAMING ROLES     ║\n╚══════════════════╝\n\nSelect your preferences below!
```

## Color and Visual Themes

### Emoji-Based Themes

**Gaming Theme:**
```
title: 🎮🕹️ GAMING CENTRAL 🕹️🎮
description: ⚡ **Level up your server experience!** ⚡\n\n🎯 Choose your gaming style below:
roles: 🖥️ @PC Master Race | 🎮 @Console Warrior | 📱 @Mobile Gamer
```

**Professional Theme:**
```
title: 💼 Professional Networking
description: 📊 **Connect with like-minded professionals**\n\n🎯 Select your industry focus:
roles: 💻 @Tech Industry | 📈 @Marketing | 🎨 @Creative Design
```

**Study Theme:**
```
title: 📚✨ ACADEMIC FOCUS ✨📚
description: 🎓 **Join study groups and academic discussions**\n\n📖 Choose your subjects:
roles: 🧮 @Mathematics | 🧪 @Science | 📝 @Literature
```

### Seasonal Themes

**Holiday Themes:**
```
title: 🎄🎅 CHRISTMAS ROLES 🎅🎄
description: 🎁 **Ho ho ho! Get into the holiday spirit!** 🎁\n\n❄️ Christmas activity roles:
roles: 🎄 @Holiday Decorator | 🍪 @Cookie Baker | 🎵 @Carol Singer
```

**Summer Theme:**
```
title: ☀️🏖️ SUMMER VIBES 🏖️☀️
description: 🌊 **Dive into summer fun!** 🌊\n\n🏄 Beach and summer activities:
roles: 🏊 @Swimming | 🏖️ @Beach Volleyball | 🍉 @Summer Treats
```

## Interactive Elements

### Reaction Instructions

**Clear Instructions:**
```
description: **📝 How to use this role menu:**\n\n1️⃣ Click an emoji to get that role\n2️⃣ Click the same emoji again to remove the role\n3️⃣ You can have multiple roles at once\n\n👇 **Choose your roles below:**
```

**Visual Step-by-Step:**
```
description: 🎯 **Role Selection Guide:**\n\n✅ **Step 1:** Click emoji → Get role\n❌ **Step 2:** Click again → Remove role\n🔄 **Step 3:** Repeat as needed\n\n⬇️ **Start selecting:**
```

### Role Descriptions in Messages

Include role descriptions within the message:

```
description: **🎮 Gaming Role Descriptions:**\n\n🖥️ **PC Gaming** - Access to PC-specific channels and events\n🎮 **Console Gaming** - PlayStation, Xbox, and Nintendo discussions\n📱 **Mobile Gaming** - Mobile game communities and tips\n🎯 **Competitive** - Ranked gameplay and tournaments\n🎲 **Casual** - Relaxed gaming and fun activities
```

## Custom Message Templates

### Template 1: Minimalist
```
/role create
title: Role Selection
description: Choose your preferences:
roles: [emoji] @Role1 | [emoji] @Role2 | [emoji] @Role3
```

### Template 2: Detailed
```
/role create
title: 🎯 SERVER ROLE MENU 🎯
description: **Welcome to [Server Name]!**\n\n📋 **Instructions:**\n• React to get roles\n• React again to remove\n• Multiple selections allowed\n\n🎮 **Available Roles:**
roles: [detailed role list]
```

### Template 3: Gaming Server
```
/role create
title: ⚔️ CHOOSE YOUR DESTINY ⚔️
description: 🛡️ **Select your warrior path!**\n\n🎯 **Class Selection:**\n━━━━━━━━━━━━━━━━━━━━━━━\n\n👇 React below to join your guild!
roles: ⚔️ @Warrior | 🏹 @Archer | 🧙‍♂️ @Mage | 🛡️ @Paladin
```

### Template 4: Study Server
```
/role create
title: 🎓 ACADEMIC ENROLLMENT 🎓
description: 📚 **Join your study groups!**\n\n📝 **Subject Selection:**\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n✏️ Click your subjects below:
roles: 🧮 @Math Study Group | 🧪 @Science Lab | 📖 @Literature Circle
```

## Advanced Customization

### Multi-Message Role Systems

Create connected role messages with consistent styling:

**Message 1: Basic Preferences**
```
title: 🌟 STEP 1: Basic Preferences 🌟
description: 🎯 **Start your journey here!**\n\n👇 Select your basic server preferences:
```

**Message 2: Gaming Preferences**
```
title: 🎮 STEP 2: Gaming Preferences 🎮
description: 🎯 **Level up your gaming experience!**\n\n👇 Choose your gaming roles:
```

**Message 3: Special Access**
```
title: ⭐ STEP 3: Special Access ⭐
description: 🎯 **Unlock exclusive features!**\n\n👇 Premium and special roles:
```

### Conditional Role Messages

Create different messages for different member types:

**New Member Message:**
```
title: 👋 WELCOME NEW MEMBER! 👋
description: 🎉 **Get started with these essential roles:**\n\n🆕 Perfect for newcomers:
roles: 🤝 @New Member | 📖 @Server Guide | 🔔 @Important Updates
```

**Veteran Member Message:**
```
title: 🏆 VETERAN MEMBER ROLES 🏆
description: 🌟 **Advanced roles for experienced members:**\n\n⭐ Exclusive access:
roles: 👑 @Veteran | 🎯 @Advanced Access | 💎 @VIP Member
```

## Best Practices for Appearance

### 1. Consistency
- Use the same formatting style across all role messages
- Maintain consistent emoji themes
- Keep similar color schemes

### 2. Readability
- Don't overuse formatting
- Keep descriptions clear and concise
- Use appropriate spacing

### 3. Server Branding
- Match your server's theme and personality
- Use colors that complement your server icon
- Include server-specific terminology

### 4. Mobile Compatibility
- Test how messages look on mobile devices
- Avoid overly long titles that get cut off
- Keep formatting mobile-friendly

### 5. Accessibility
- Use clear, high-contrast emojis
- Provide text descriptions for roles
- Don't rely solely on colors to convey meaning

## Testing Your Appearance

### Preview Before Publishing
1. Create the role message in a test channel first
2. Check how it looks on both desktop and mobile
3. Ask other admins for feedback
4. Make adjustments as needed

### Regular Reviews
- Update seasonal themes periodically
- Refresh outdated styling
- Get member feedback on appearance
- Keep up with Discord formatting changes

Remember: A well-designed role message not only looks professional but also encourages more members to engage with your server's role system!
