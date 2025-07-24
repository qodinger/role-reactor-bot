# General Commands

Learn about the commands available to all members for interacting with Role Reactor Bot and managing their own roles.

## Member Commands Overview

Role Reactor Bot provides several commands that regular members can use to interact with the role system, get information, and manage their personal role preferences.

## Basic Information Commands

### `/help`
**Description:** Display general help information about the bot
**Usage:** `/help`
**Who can use:** Everyone
**Example:**
```
/help
```

**Bot Response:**
```
🤖 **Role Reactor Bot Help**

I help manage self-assignable roles in your server!

**Basic Usage:**
• React to role messages to get/remove roles
• Use /myroles to see your current roles
• Use /roleinfo to learn about specific roles

**Need more help?** Ask server staff or check the documentation!
```

### `/roleinfo`
**Description:** Get detailed information about a specific role
**Usage:** `/roleinfo role:[role]`
**Who can use:** Everyone
**Parameters:**
- `role` - The role you want information about

**Example:**
```
/roleinfo role:@Gaming
```

**Bot Response:**
```
🎮 **Role Information: Gaming**

📊 **Stats:**
• Members with this role: 247
• Created: March 15, 2024
• Color: Blue (#3498db)

📝 **Description:**
Access to gaming channels and LFG (Looking for Group) features

🔗 **How to get this role:**
React with 🎮 in #role-selection

⚡ **Permissions:**
• View gaming channels
• Send messages in gaming chat
• Use gaming voice channels
```

### `/myroles`
**Description:** View all your current assignable roles
**Usage:** `/myroles`
**Who can use:** Everyone

**Example:**
```
/myroles
```

**Bot Response:**
```
👤 **Your Current Roles**

🎮 **Gaming Roles:**
• PC Gaming
• Competitive Player

🔔 **Notification Roles:**
• Important Updates
• Event Announcements

📚 **Study Roles:**
• Mathematics Study Group

⭐ **Special Roles:**
• Helpful Member

**Total assignable roles:** 6 out of 24 available

💡 **Tip:** Visit #role-selection to add more roles!
```

## Role Management Commands

### `/removerole`
**Description:** Remove a specific role from yourself
**Usage:** `/removerole role:[role]`
**Who can use:** Everyone (only affects their own roles)
**Parameters:**
- `role` - The role you want to remove from yourself

**Example:**
```
/removerole role:@Mobile Gaming
```

**Bot Response:**
```
✅ **Role Removed Successfully**

Removed **Mobile Gaming** from your roles.

You can get it back anytime by reacting in #role-selection!
```

**Error Examples:**
```
❌ You don't have the role "Mobile Gaming"
❌ I don't have permission to remove this role
❌ This role cannot be self-removed
```

### `/addrole` (If enabled by server)
**Description:** Add a role to yourself without using reactions
**Usage:** `/addrole role:[role]`
**Who can use:** Everyone (if enabled by server admins)
**Parameters:**
- `role` - The role you want to add to yourself

**Example:**
```
/addrole role:@Study Group
```

**Bot Response:**
```
✅ **Role Added Successfully**

Added **Study Group** to your roles!

🎯 **What this gives you:**
• Access to study channels
• Study session notifications
• Homework help discussions
```

## Information Discovery Commands

### `/rolelist`
**Description:** View all available self-assignable roles
**Usage:** `/rolelist [category]`
**Who can use:** Everyone
**Parameters:**
- `category` (optional) - Filter by specific category

**Example:**
```
/rolelist category:Gaming
```

**Bot Response:**
```
🎮 **Available Gaming Roles**

**Platform Preferences:**
🖥️ PC Gaming - 156 members
🎮 Console Gaming - 134 members  
📱 Mobile Gaming - 89 members

**Play Styles:**
🎯 Competitive Player - 67 members
🎲 Casual Gamer - 203 members
👥 Team Player - 145 members

**Game Types:**
🔫 FPS Games - 98 members
⚔️ RPG Games - 112 members
🏁 Racing Games - 45 members

💡 **How to get these roles:** React in #role-selection
```

### `/rolecount`
**Description:** See how many members have each role
**Usage:** `/rolecount [role]`
**Who can use:** Everyone
**Parameters:**
- `role` (optional) - Check specific role count

**Example:**
```
/rolecount role:@Gaming
```

**Bot Response:**
```
🎮 **Gaming Role Statistics**

👥 **Current members:** 247 out of 892 total server members
📈 **Popularity:** 27.7% of server members
📊 **Rank:** #3 most popular role

**Recent activity:**
• +12 members this week
• +45 members this month
• Trending upward 📈
```

## Search and Discovery

### `/findroles`
**Description:** Search for roles by keyword or interest
**Usage:** `/findroles search:[keyword]`
**Who can use:** Everyone
**Parameters:**
- `search` - Keyword to search for in role names and descriptions

**Example:**
```
/findroles search:music
```

**Bot Response:**
```
🎵 **Roles matching "music":**

🎵 **Music Discussion** - 78 members
Chat about your favorite artists and songs

🎧 **Music Production** - 34 members  
Share and discuss music creation

🎤 **Karaoke Nights** - 56 members
Join our weekly karaoke events

🎼 **Classical Music** - 23 members
Appreciate orchestral and classical compositions

💡 **How to get these:** React in #role-selection
```

### `/popular`
**Description:** View the most popular roles in the server
**Usage:** `/popular [limit]`
**Who can use:** Everyone
**Parameters:**
- `limit` (optional) - Number of roles to show (default: 10)

**Example:**
```
/popular limit:5
```

**Bot Response:**
```
🏆 **Top 5 Most Popular Roles**

1. 💬 **General Chat** - 678 members (76%)
2. 🔔 **Important Updates** - 543 members (61%)
3. 🎮 **Gaming** - 247 members (28%)
4. 📚 **Study Group** - 189 members (21%)
5. 🎵 **Music** - 167 members (19%)

📈 **Trending this week:**
↗️ Gaming (+15%)
↗️ Art & Design (+8%)
↘️ Movie Nights (-3%)
```

## Personal Preferences

### `/preferences`
**Description:** View and manage your role preferences
**Usage:** `/preferences`
**Who can use:** Everyone

**Bot Response:**
```
⚙️ **Your Role Preferences**

🔔 **Notifications:**
• Role addition confirmations: ✅ Enabled
• Role removal confirmations: ✅ Enabled  
• Weekly role suggestions: ❌ Disabled

📊 **Privacy:**
• Show my roles in /myroles: ✅ Public
• Include me in role statistics: ✅ Yes

🎯 **Suggestions:**
• Recommend roles based on activity: ✅ Enabled
• Show similar roles: ✅ Enabled

**Change these settings with /settings**
```

### `/settings`
**Description:** Modify your personal bot settings
**Usage:** `/settings setting:[option] value:[true/false]`
**Who can use:** Everyone
**Parameters:**
- `setting` - Which setting to change
- `value` - New value for the setting

**Example:**
```
/settings setting:notifications value:false
```

**Bot Response:**
```
✅ **Setting Updated**

**Role notifications** set to **disabled**

You will no longer receive confirmation messages when you add or remove roles.

💡 **Change anytime with:** `/settings setting:notifications value:true`
```

## Utility Commands

### `/suggest`
**Description:** Get role suggestions based on your interests
**Usage:** `/suggest [interests]`
**Who can use:** Everyone
**Parameters:**
- `interests` (optional) - Keywords describing your interests

**Example:**
```
/suggest interests:gaming programming art
```

**Bot Response:**
```
🎯 **Suggested Roles for You**

**Based on "gaming programming art":**

🎮 **Gaming Roles:**
• PC Gaming - Matches your gaming interest
• Indie Games - Creative gaming community

💻 **Programming Roles:**  
• Web Development - Active programming community
• Code Reviews - Help others with code

🎨 **Creative Roles:**
• Digital Art - Share your artwork
• Design Feedback - Get critiques on designs

**Already have:** Gaming ✅

💡 **React in #role-selection to get these roles!**
```

### `/rolehistory`
**Description:** View your recent role changes
**Usage:** `/rolehistory [limit]`
**Who can use:** Everyone
**Parameters:**
- `limit` (optional) - Number of recent changes to show

**Example:**
```
/rolehistory limit:5
```

**Bot Response:**
```
📋 **Your Recent Role Changes**

**Today:**
• ➕ Added **Art & Design** at 2:15 PM
• ➖ Removed **Mobile Gaming** at 1:30 PM

**Yesterday:**
• ➕ Added **Study Group** at 6:45 PM
• ➕ Added **Event Notifications** at 6:44 PM

**March 20:**
• ➖ Removed **Casual Gaming** at 11:20 AM

💡 **Showing last 5 changes** • Use `/rolehistory limit:10` for more
```

## Command Tips and Best Practices

### Getting Help
- Use `/help` for general information
- Ask in designated help channels for complex questions
- Check role descriptions before adding roles
- Read server rules about role usage

### Efficient Role Management
- Use `/myroles` regularly to review your roles
- Remove roles you no longer need with `/removerole`
- Use `/suggest` to discover new relevant roles
- Check `/popular` to see trending roles

### Staying Informed
- Use `/roleinfo` to understand what roles provide
- Check `/rolecount` to see community engagement
- Use `/findroles` to discover roles by interest
- Monitor your `/rolehistory` for accidental changes

### Privacy and Settings
- Adjust `/preferences` to control notifications
- Use `/settings` to customize your experience
- Consider your privacy preferences for role visibility

Remember: These commands are designed to help you get the most out of your server's role system. Don't hesitate to experiment and find the roles that best match your interests!
