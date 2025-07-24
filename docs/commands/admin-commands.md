# Admin Commands

Complete reference for all administrator commands in Role Reactor Bot. These commands require "Manage Roles" permission.

## 🎯 Core Role Management Commands

### `/setup-roles` - Create Role Messages

**Create a new role assignment message**

```
/setup-roles title:"Your Title" description:"Your description" roles:"emoji:Role,emoji:Role" [color:"#hexcode"]
```

#### Parameters:
- **`title`** (required) - The main heading for your role message
- **`description`** (required) - Explanation text for members  
- **`roles`** (required) - Emoji-role pairs in format `emoji:RoleName,emoji:RoleName`
- **`color`** (optional) - Hex color code for embed border (e.g., `#7289DA`)

#### Examples:

**Basic role message:**
```
/setup-roles title:"Server Roles" description:"React to get roles!" roles:"🎮:Gamer,🎨:Artist,💻:Developer"
```

**With categories and color:**
```
/setup-roles title:"🌟 Community Roles" description:"Choose your interests!" roles:"#Gaming\n🎮:Gamer,🎲:Board Games\n#Creative\n🎨:Artist,📸:Photographer" color:"#43AA8B"
```

**Advanced formatting:**
```
/setup-roles title:"🎯 Server Roles" description:"**Welcome!**\n\n*Choose roles that match your interests:*\n\n• 🎮 Gaming channels\n• 🎨 Creative spaces\n• 💻 Tech discussions" roles:"🎮:Gamer,🎨:Artist,💻:Developer" color:"#7289DA"
```

---

### `/update-roles` - Modify Existing Messages

**Update an existing role message**

```
/update-roles message_id:123456789 [title:"New Title"] [description:"New description"] [roles:"new:roles"] [color:"#hexcode"]
```

#### Parameters:
- **`message_id`** (required) - ID of the message to update
- **`title`** (optional) - New title text
- **`description`** (optional) - New description text
- **`roles`** (optional) - New emoji-role configuration
- **`color`** (optional) - New embed color

#### How to Find Message ID:
1. **Enable Developer Mode** in Discord settings
2. **Right-click the role message**
3. **Select "Copy ID"**

#### Examples:

**Update title only:**
```
/update-roles message_id:987654321098765432 title:"🆕 Updated Server Roles"
```

**Update roles configuration:**
```
/update-roles message_id:987654321098765432 roles:"🎮:Gamer,🎨:Artist,💻:Developer,🎵:Musician"
```

**Complete update:**
```
/update-roles message_id:987654321098765432 title:"New Title" description:"Updated description with new info!" roles:"🎮:Gamer,🎨:Artist" color:"#FF6B6B"
```

---

### `/list-roles` - View All Role Messages

**Display all role assignment messages in your server**

```
/list-roles
```

#### What it shows:
- **Message ID** - For use with other commands
- **Channel** - Where the message is located
- **Title** - The message title
- **Role count** - Number of roles in the message
- **Created date** - When it was set up

#### Example output:
```
📋 Role Messages in Your Server

🎮 Gaming Roles
├─ ID: 123456789012345678
├─ Channel: #roles
├─ Roles: 6 roles configured
└─ Created: 2 days ago

🌟 Community Roles  
├─ ID: 987654321098765432
├─ Channel: #welcome
├─ Roles: 4 roles configured
└─ Created: 1 week ago
```

---

### `/delete-roles` - Remove Role Messages

**Delete a role assignment message**

```
/delete-roles message_id:123456789
```

#### Parameters:
- **`message_id`** (required) - ID of the message to delete

{% hint style="warning" %}
**Important:** This only removes the bot's role assignment functionality. Members keep any roles they already have.
{% endhint %}

#### Example:
```
/delete-roles message_id:123456789012345678
```

## ⏰ Temporary Role Commands

### `/assign-temp-role` - Give Temporary Roles

**Assign a role that expires automatically**

```
/assign-temp-role user:@member role:@RoleName duration:2h [reason:"Optional reason"]
```

#### Parameters:
- **`user`** (required) - Member to assign role to
- **`role`** (required) - Role to assign
- **`duration`** (required) - How long the role lasts
- **`reason`** (optional) - Why the role was assigned

#### Duration formats:
- `30m` - 30 minutes
- `2h` - 2 hours  
- `1d` - 1 day
- `1w` - 1 week
- Maximum: `4w` (4 weeks)

#### Examples:

**Event access role:**
```
/assign-temp-role user:@JohnDoe role:@MovieNight duration:3h reason:"Movie night event access"
```

**Trial VIP role:**
```
/assign-temp-role user:@NewMember role:@VIP duration:1w reason:"Welcome week VIP trial"
```

**Contest winner role:**
```
/assign-temp-role user:@Winner role:@Champion duration:1d reason:"Daily contest winner"
```

---

### `/list-temp-roles` - View Temporary Roles

**Show all active temporary roles in your server**

```
/list-temp-roles [user:@member]
```

#### Parameters:
- **`user`** (optional) - Show temporary roles for specific member only

#### What it shows:
- **Member name** - Who has the temporary role
- **Role name** - Which role they have
- **Expires** - When the role will be removed
- **Reason** - Why it was assigned
- **Time left** - Remaining duration

#### Example output:
```
⏰ Active Temporary Roles

@JohnDoe
├─ Role: @MovieNight
├─ Expires: in 2 hours 15 minutes
└─ Reason: Movie night event access

@NewMember
├─ Role: @VIP
├─ Expires: in 5 days 3 hours  
└─ Reason: Welcome week VIP trial
```

---

### `/remove-temp-role` - Remove Temporary Roles

**Manually remove a temporary role before it expires**

```
/remove-temp-role user:@member role:@RoleName
```

#### Parameters:
- **`user`** (required) - Member to remove role from
- **`role`** (required) - Temporary role to remove

#### Example:
```
/remove-temp-role user:@JohnDoe role:@EventAccess
```

## 📊 Information Commands

### `/help` - Bot Information

**Display bot information and quick help**

```
/help
```

Shows:
- Bot version and status
- Quick command overview
- Links to documentation
- Support information

---

## 🛡️ Permission Requirements

### Required Discord Permissions

For **Role Reactor Bot** to work, it needs:
- ✅ **Manage Roles** - To assign/remove roles from members
- ✅ **Manage Messages** - To add reactions to messages
- ✅ **Add Reactions** - To react with emojis
- ✅ **Read Message History** - To detect reaction events
- ✅ **View Channel** - To access channels
- ✅ **Send Messages** - To respond to commands

### Required User Permissions

To use admin commands, you need:
- ✅ **Manage Roles** permission in the server
- OR **Administrator** permission
- OR be the **Server Owner**

### Role Hierarchy Rules

{% hint style="warning" %}
**Critical:** The bot can only manage roles that are **below** its own role in your server's role hierarchy!
{% endhint %}

**Correct hierarchy:**
```
@Administrators     ← Your admin role
@Role Reactor Bot   ← Bot role here
@VIP Members        ← Bot can manage ✅
@Gamers            ← Bot can manage ✅
@Artists           ← Bot can manage ✅
@everyone          ← Lowest level
```

## 🚨 Common Issues & Solutions

### "Missing Permissions" Error

**Causes:**
- Bot doesn't have "Manage Roles" permission
- Bot role is below roles it's trying to manage
- Channel-specific permission restrictions

**Solutions:**
1. Check bot permissions in Server Settings
2. Move bot role higher in role hierarchy
3. Check channel-specific permissions

### "Role not found" Error

**Causes:**
- Role name doesn't match exactly (case-sensitive)
- Role was deleted after message creation
- Typo in role name

**Solutions:**
1. Check exact role spelling in Server Settings > Roles
2. Recreate deleted roles
3. Update role message with correct names

### Commands Not Appearing

**Causes:**
- Slash commands not deployed to your server
- Bot lacks "Use Application Commands" permission
- Discord cache issue

**Solutions:**
1. Wait a few minutes for commands to sync
2. Check bot permissions
3. Try in a different channel
4. Kick and re-invite bot if necessary

### Emojis Not Working

**Causes:**
- Custom emoji format incorrect
- External emoji not accessible
- Unicode emoji not supported

**Solutions:**
1. Use `\:emoji_name:` to get proper custom emoji format
2. Use server-specific emojis when possible
3. Test with standard Unicode emojis first

## 💡 Pro Tips

### Efficient Role Management
- **Create roles first** before setting up role messages
- **Use consistent naming** conventions for roles
- **Test with simple setups** before creating complex ones
- **Keep role hierarchies** organized and logical

### Better User Experience
- **Use descriptive titles** that explain the purpose
- **Write clear descriptions** with instructions
- **Choose intuitive emojis** that match role purposes
- **Organize with categories** for large role sets

### Server Organization
- **Dedicate a #roles channel** for role assignment
- **Pin important role messages** for visibility  
- **Use channel topics** to explain role systems
- **Regular maintenance** - clean up unused roles

---

Need help with a specific command? Check our [troubleshooting guide](../troubleshooting/common-issues.md) or [get support](../support/getting-help.md)!
