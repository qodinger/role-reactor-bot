# Your First Role Setup

Create your first role assignment message and see Role Reactor Bot in action!

## 🎯 Quick Start Example

Let's create a simple role message that your members can use right away.

### Step 1: Choose Your Roles

First, decide what roles you want members to be able to assign themselves. For this example, we'll use:

- **🎮 Gamer** - For gaming enthusiasts
- **🎨 Artist** - For creative members  
- **💻 Developer** - For tech-minded people

{% hint style="info" %}
**Make sure these roles exist** in your server before creating the role message! Go to Server Settings > Roles to create them if needed.
{% endhint %}

### Step 2: Create the Role Message

In any channel where you want the role message to appear, type:

```
/setup-roles title:"Choose Your Roles" description:"React below to assign yourself roles!" roles:"🎮:Gamer,🎨:Artist,💻:Developer"
```

**What this does:**
- Creates a message titled "Choose Your Roles"
- Adds a description explaining what to do
- Sets up 3 emoji-role pairs (🎮 for Gamer, 🎨 for Artist, 💻 for Developer)

### Step 3: Test It Out!

1. **Look for the new message** that appeared
2. **Click the 🎮 reaction** - you should get the "Gamer" role
3. **Check your role list** in the member sidebar
4. **Remove the reaction** to remove the role

{% hint style="success" %}
**It worked!** Your members can now self-assign roles by reacting to your message!
{% endhint %}

## 🎨 Making It Look Better

Let's improve the appearance with a custom color and better description:

```
/setup-roles title:"🌟 Community Roles" description:"**Welcome to our server!**\n\nChoose roles that match your interests:\n\n• 🎮 Gaming enthusiasts\n• 🎨 Creative minds\n• 💻 Tech lovers" roles:"🎮:Gamer,🎨:Artist,💻:Developer" color:"#7289DA"
```

**New features used:**
- **Custom color** (`#7289DA` - Discord's blue)
- **Bold text** with `**bold**`
- **Line breaks** with `\n`  
- **Bullet points** with `•`

## 📱 Understanding the Results

When you create a role message, here's what your members will see:

### The Message Appearance
```
🌟 Community Roles

Welcome to our server!

Choose roles that match your interests:

• 🎮 Gaming enthusiasts
• 🎨 Creative minds  
• 💻 Tech lovers

🎮 🎨 💻
```

### How Members Use It
1. **See the message** in the channel
2. **Read the description** to understand what each emoji means
3. **Click emoji reactions** to get roles
4. **Remove reactions** to remove roles
5. **Check their profile** to see new roles

## 🗂️ Organizing with Categories

For servers with many roles, organize them into categories:

```
/setup-roles title:"Server Roles" description:"Choose your roles by category!" roles:"#Gaming\n🎮:Gamer,🎲:Board Games,🕹️:Retro Gaming\n#Creative\n🎨:Artist,📸:Photographer,✍️:Writer" color:"#43AA8B"
```

**This creates:**

```
Server Roles

Choose your roles by category!

─────── Gaming ───────
🎮 🎲 🕹️

─────── Creative ───────  
🎨 📸 ✍️
```

## 🔧 Managing Your Role Messages

### Update an Existing Message

Want to change something? Use the message ID to update:

```
/update-roles message_id:1234567890 title:"Updated Title" description:"New description" roles:"🎮:Gamer,🎵:Music Lover"
```

{% hint style="info" %}
**Finding Message ID:** Right-click the role message and select "Copy ID" (you need Developer Mode enabled in Discord settings).
{% endhint %}

### See All Your Role Messages

```
/list-roles
```

This shows all role messages in your server with their IDs and details.

### Delete a Role Message

```
/delete-roles message_id:1234567890
```

{% hint style="warning" %}
**Note:** This only removes the bot's functionality. Members keep any roles they already have.
{% endhint %}

## 🎯 Best Practices for Your First Setup

### Start Simple
- **Begin with 3-5 roles** to test the system
- **Use clear, recognizable emojis**
- **Choose roles that many members will want**

### Pick the Right Channel
- **#roles channel** - Dedicated channel for role assignment
- **#welcome channel** - High visibility for new members
- **#general channel** - Easy access for everyone

### Test Before Announcing
1. **Test role assignment yourself**
2. **Check role hierarchy** is correct
3. **Verify all emojis work**
4. **Make sure descriptions are clear**

## 📋 Common First-Time Issues

### "Missing Permissions" Error
- **Check bot role position** - must be above roles it manages
- **Verify bot permissions** - needs "Manage Roles"

### Emojis Not Working
- **Use standard emojis first** (🎮, 🎨, 💻)
- **Custom emojis** need proper format: `<:name:id>`

### Roles Not Assigning
- **Check exact role names** - must match perfectly (case-sensitive)
- **Verify role hierarchy** - bot role above target roles

### Members Can't See Commands
- **Slash commands** may take a few minutes to appear
- **Check channel permissions** for "Use Application Commands"

## 🎉 Next Steps

Congratulations! You've set up your first role assignment system. Here's what to explore next:

### Expand Your Setup
- [Learn about advanced emoji usage](../role-setup/emojis-and-roles.md)
- [Organize roles with categories](../role-setup/categories.md)  
- [Customize appearance further](../role-setup/customizing.md)

### Explore Advanced Features
- [Set up temporary roles](../management/temporary-roles.md)
- [See example server configurations](../examples/gaming-server.md)

### Help Your Members
- [Share user guide with your community](../members/getting-roles.md)
- [Pin the role message](../management/best-practices.md)

---

**Great job setting up your first role system!** Your community can now self-manage their roles with ease. 🚀
