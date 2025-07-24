# Creating Role Messages

Learn how to create beautiful, functional role assignment messages that your members will love to use.

## 🚀 Quick Start Command

The basic command to create a role message:

```
/setup-roles title:"Your Title" description:"Your description" roles:"emoji:RoleName,emoji:RoleName"
```

### Simple Example

```
/setup-roles title:"Choose Your Roles" description:"React to get roles!" roles:"🎮:Gamer,🎨:Artist,💻:Developer"
```

**This creates:**
- A message titled "Choose Your Roles"
- Description explaining what to do
- Three emoji-role pairs that members can click

## 📝 Command Parameters

### Required Parameters

#### `title`
**The main heading** for your role message.

```
title:"Server Roles"
title:"🌟 Community Interests"
title:"Gaming Preferences"
```

**Tips:**
- Keep it short and descriptive
- Use emojis to make it eye-catching
- Make it clear what the message is for

#### `description`
**The explanation text** below the title.

```
description:"React below to assign yourself roles!"
description:"Choose roles that match your interests and get access to special channels."
```

**Tips:**
- Explain what members should do
- Mention benefits of getting roles
- Use line breaks (`\n`) for better formatting

#### `roles`
**The emoji-role pairs** that define what each reaction does.

```
roles:"🎮:Gamer,🎨:Artist,💻:Developer"
```

**Format:** `emoji:RoleName,emoji:RoleName`
- **Colon (`:`)** separates emoji from role name
- **Comma (`,`)** separates different emoji-role pairs
- **No spaces** around separators

### Optional Parameters

#### `color`
**Customize the embed border color** using hex codes.

```
color:"#7289DA"  ← Discord blue
color:"#FF6B6B"  ← Red
color:"#4ECDC4"  ← Turquoise
```

**Popular colors:**
- `#7289DA` - Discord Blue
- `#43AA8B` - Green
- `#F39C12` - Orange  
- `#9B59B6` - Purple
- `#E74C3C` - Red

## 🎨 Enhanced Formatting

### Rich Descriptions
Use Discord markdown to enhance your descriptions:

```
/setup-roles title:"🌟 Server Roles" description:"**Welcome to our community!**\n\n*Choose roles that interest you:*\n\n• 🎮 For gaming discussions\n• 🎨 For creative channels\n• 💻 For tech talks\n\n*Click the emojis below!*" roles:"🎮:Gamer,🎨:Artist,💻:Developer" color:"#7289DA"
```

**Markdown options:**
- `**bold text**` - **Bold formatting**
- `*italic text*` - *Italic formatting*
- `\n` - Line break
- `• ` - Bullet points
- `[link text](url)` - Links

### Multi-line Descriptions
For longer explanations:

```
description:"**🎯 Role Assignment System**\n\nReact with emojis below to get roles instantly!\n\n📋 **Benefits:**\n• Access to role-specific channels\n• Notifications for your interests\n• Connect with like-minded members\n\n🔄 **How it works:**\n• Click emoji = Get role\n• Remove reaction = Remove role"
```

## 🗂️ Organizing with Categories

### Category Format
Use `#CategoryName` to create organized sections:

```
roles:"#Gaming\n🎮:Gamer,🎲:Board Games,🕹️:Retro Gaming\n#Creative\n🎨:Artist,📸:Photographer,✍️:Writer"
```

### Category Example

```
/setup-roles title:"🎯 Community Roles" description:"**Choose your interests!**\n\nRoles are organized by category - pick from any or all sections." roles:"#🎮 Gaming\n🎮:PC Gamer,🎮:Console Gamer,📱:Mobile Gamer\n#🎨 Creative\n🎨:Artist,📸:Photographer,🎵:Musician\n#💼 Professional\n💻:Developer,📊:Marketing,✏️:Writer" color:"#43AA8B"
```

**Visual result:**
```
🎯 Community Roles

Choose your interests!

Roles are organized by category - pick from any or all sections.

─────── 🎮 Gaming ───────
🎮 🎮 📱

─────── 🎨 Creative ───────
🎨 📸 🎵

─────── 💼 Professional ───────
💻 📊 ✏️
```

## 🎯 Real-World Examples

### Gaming Community

```
/setup-roles title:"🎮 Gaming Roles" description:"**Join our gaming community!**\n\nGet roles to find teammates and stay updated on your favorite games.\n\n*Multiple selections encouraged!*" roles:"#Platforms\n🖥️:PC Gaming,🎮:Console Gaming,📱:Mobile Gaming\n#Genres\n🔫:FPS Games,⚔️:RPG Games,🏎️:Racing Games\n#Communication\n🎤:Voice Chat,💬:Text Only" color:"#7289DA"
```

### Study Server

```
/setup-roles title:"📚 Study Groups" description:"**Academic Role Assignment**\n\nSelect your subjects and study preferences to connect with classmates.\n\n📖 *Find study partners in your field!*" roles:"#Subjects\n🔬:Science,📐:Mathematics,💻:Computer Science,📜:History\n#Study Style\n👥:Group Study,📖:Solo Study,🌙:Night Owl\n#Year Level\n1️⃣:Freshman,2️⃣:Sophomore,3️⃣:Junior,4️⃣:Senior" color:"#F39C12"
```

### Creative Community

```
/setup-roles title:"🎨 Creative Hub" description:"**Showcase your creative side!**\n\nJoin channels dedicated to your artistic interests and share your work.\n\n✨ *Collaborate with fellow creators!*" roles:"#Visual Arts\n🎨:Digital Art,🖼️:Traditional Art,📸:Photography\n#Writing\n✍️:Creative Writing,📚:Poetry,📝:Blogging\n#Music\n🎵:Music Production,🎸:Instruments,🎤:Vocals" color:"#E74C3C"
```

## ⚙️ Advanced Techniques

### Notification Roles

```
/setup-roles title:"🔔 Notification Preferences" description:"**Control what pings you get!**\n\nSelect notification types you want to receive. You can change these anytime.\n\n🔕 *Only get notifications you actually want!*" roles:"📢:Server Announcements,🎉:Events & Activities,📝:Updates & News,🚨:Important Alerts,🎮:Gaming Events,🎵:Music Sessions" color:"#3498DB"
```

### Skill Showcase

```
/setup-roles title:"💪 Skills & Expertise" description:"**Show off your skills!**\n\nLet others know what you're good at and find collaboration opportunities.\n\n🤝 *Perfect for networking and project partnerships!*" roles:"#Programming\n🐍:Python,☕:JavaScript,#️⃣:C#,🦀:Rust\n#Design\n🎨:Graphic Design,🎭:UI/UX,📐:3D Modeling\n#Other Skills\n📊:Data Analysis,📝:Content Writing,🎤:Public Speaking" color:"#2ECC71"
```

## 🔧 Command Tips & Tricks

### Testing Your Command
Before creating the final message:

1. **Test in a private channel** first
2. **Use simple roles** for testing (create test roles if needed)
3. **Check emoji formatting** - some emojis may not work
4. **Verify role names** are spelled exactly right

### Role Name Requirements
- **Exact spelling** - case sensitive
- **Must exist** - create roles in Server Settings first
- **No special formatting** - just the plain role name
- **Bot must be able to assign** - check role hierarchy

### Common Mistakes to Avoid

**❌ Wrong separators:**
```
roles:"🎮 : Gamer , 🎨 : Artist"  ← Extra spaces
```

**✅ Correct format:**
```
roles:"🎮:Gamer,🎨:Artist"  ← No spaces around separators
```

**❌ Role doesn't exist:**
```
roles:"🎮:Gmr"  ← Typo in role name
```

**✅ Exact role name:**
```
roles:"🎮:Gamer"  ← Must match Discord role exactly
```

## 📋 Pre-Creation Checklist

Before running `/setup-roles`, make sure:

- [ ] **All roles exist** in your server
- [ ] **Bot role is positioned** above roles it will manage
- [ ] **Bot has permissions** in the channel you're using
- [ ] **Emoji codes are correct** (test custom emojis)
- [ ] **Role names match exactly** (case-sensitive)
- [ ] **Channel is appropriate** for role assignment

## 🎯 After Creation

### What Happens Next
1. **Bot creates the message** with your title and description
2. **Emoji reactions appear** below the message automatically  
3. **Members can immediately** start reacting to get roles
4. **Message is stored** in bot's database for persistence

### Testing Your New Message
1. **React to test emojis** yourself
2. **Check if you get the roles** in your member list
3. **Remove reactions** to test role removal
4. **Ask other members** to test it too

### Making Adjustments
If something needs changing, use:
```
/update-roles message_id:123456789 (parameters to change)
```

---

Ready to organize your roles better? Learn about [Using Emojis and Roles](emojis-and-roles.md) next!
