# Adding the Bot to Your Server

Get Role Reactor Bot up and running in your Discord server in just a few clicks!

## 🎯 Quick Add (Recommended)

{% hint style="success" %}
**Fastest way:** Use our pre-configured invitation link with all the right permissions!
{% endhint %}

### Step 1: Click the Invite Link

[**🤖 Add Role Reactor Bot to Your Server**](https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=268823616&scope=bot%20applications.commands)

### Step 2: Select Your Server

1. **Choose your server** from the dropdown menu
2. **Make sure you have permission** to add bots (you need "Manage Server" permission)
3. Click **"Continue"**

### Step 3: Review Permissions

The bot needs these permissions to work properly:

- ✅ **Manage Roles** - To give and remove roles from members
- ✅ **Send Messages** - To respond to your commands
- ✅ **Add Reactions** - To add emoji reactions to messages
- ✅ **Read Message History** - To see when people react
- ✅ **View Channel** - To see channels where it operates

Click **"Authorize"** to confirm these permissions.

### Step 4: Verify the Bot Joined

1. **Check your server member list** - Role Reactor Bot should appear online
2. **Look in your channels** - The bot should be visible
3. **Test with a command** - Try typing `/help` to see if it responds

## 🔧 Manual Permission Setup

If you prefer to set up permissions manually or need to adjust them later:

### Required Permissions Checklist

Make sure Role Reactor Bot has these permissions in your server:

- [ ] **Manage Roles** - Essential for role assignment
- [ ] **Send Messages** - To respond to commands
- [ ] **Add Reactions** - To add emojis to role messages
- [ ] **Read Message History** - To detect when members react
- [ ] **View Channel** - To access channels where it works
- [ ] **Use Slash Commands** - To register and use commands

### Permission Number

If you need the permission number: **268823616**

## 🎭 Setting Up Bot Role Position

{% hint style="warning" %}
**Important:** The bot can only manage roles that are **below** its own role in your server's role hierarchy!
{% endhint %}

### Step 1: Go to Server Settings

1. **Right-click your server name**
2. Select **"Server Settings"**
3. Click **"Roles"** in the left sidebar

### Step 2: Position the Bot Role

1. **Find "Role Reactor Bot" role** in the list
2. **Drag it up** so it's above any roles you want it to manage
3. **Save changes**

### Example Role Hierarchy

```
@Server Owner (highest)
@Administrators
@Moderators
@Role Reactor Bot  ← Bot role here
@VIP Members       ← Can manage this
@Gamers           ← Can manage this
@Artists          ← Can manage this
@everyone (lowest)
```

## 🎨 Customizing Bot Appearance (Optional)

### Change Bot Nickname

1. **Right-click the bot** in your member list
2. Select **"Change Nickname"**
3. **Enter a custom name** (e.g., "Role Manager", "🎭 Roles")

### Create Custom Role for Bot

1. **Go to Server Settings > Roles**
2. **Create a new role** with a custom name and color
3. **Assign it to Role Reactor Bot**
4. **Position it correctly** in the hierarchy

## ✅ Quick Test

Once the bot is added, let's make sure everything works:

### Test 1: Check Bot Response

Type this in any channel where the bot can see:
```
/help
```

**Expected result:** The bot responds with a help message

### Test 2: Check Permissions

Try creating a simple role message:
```
/setup-roles title:"Test" description:"Testing!" roles:"😀:Test Role"
```

**Expected result:** The bot creates a message with a 😀 reaction

### Test 3: Test Role Assignment

1. **React to the test message** with 😀
2. **Check if you got the role** in your member list
3. **Remove the reaction** to remove the role

## 🚨 Troubleshooting

### Bot Not Responding?

**Check these common issues:**

1. **Bot permissions** - Make sure it can "Send Messages" and "Use Slash Commands"
2. **Channel permissions** - Bot needs access to the specific channel
3. **Bot status** - Make sure the bot shows as "Online" (not offline)

### Can't See Slash Commands?

1. **Wait a moment** - Commands can take a few minutes to appear
2. **Check permissions** - You need "Use Application Commands" permission
3. **Try in different channel** - Some channels might restrict slash commands

### Permission Errors?

1. **Check bot role position** - Must be above roles it manages
2. **Verify bot permissions** - Re-invite if needed
3. **Check channel-specific permissions** - Bot might be restricted in certain channels

## 🎉 Success!

If the bot responded to `/help` and you could create a test role message, you're all set! 

**Next steps:**
- [Create your first real role setup](first-setup.md)
- [Learn about organizing roles](../role-setup/categories.md)
- [See example server setups](../examples/gaming-server.md)

---

**Having trouble?** Check our [troubleshooting guide](../troubleshooting/common-issues.md) or [get support](../support/getting-help.md)!
