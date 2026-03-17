# 🎉 Giveaway System

A complete giveaway management system for Discord servers with advanced security, customization, and industry-leading features.

## ✨ Features

### 🎁 Core Features
- **Easy Giveaway Creation**: Simple slash command setup
- **Automatic Timer**: Giveaways end automatically at specified time
- **Fair Winner Selection**: Weighted random selection with bonus entries
- **One-Click Entry**: Users enter with a single button click
- **Multiple Winners**: Support for 1-10 winners per giveaway
- **Auto DM Winners**: Automatic winner notifications via DM

### 🔒 Security Features (Industry Standard)
- **Permission-Based Creation**: Staff-only by default
- **Custom Creator Roles**: Allow trusted members to create giveaways
- **Rate Limiting**: Max active giveaways per user (default: 3)
- **Channel Restrictions**: Limit giveaways to specific channels
- **Account Age Requirements**: Prevent alt account abuse (default: 7 days)
- **Server Age Requirements**: Require minimum server membership (default: 1 day)
- **Bot Exclusion**: Automatically exclude bot accounts
- **Configurable Claim Period**: Set prize claim deadline (24h-7d)

### 🎯 Advanced Features
- **Bonus Entries**: Extra entries for roles/server boosters
- **Giveaway Editing**: Fix mistakes after creation
- **Reroll System**: Select new winners if needed
- **Statistics Tracking**: Monitor giveaway performance
- **Giveaway Logging**: Audit trail in log channel
- **Custom Colors**: Brand your giveaways
- **Thumbnail Support**: Add images to giveaways

---

## 📋 Commands

### `/giveaway` (All-in-One)

**Public Subcommands** (Everyone can use):
- `/giveaway list` - View all active giveaways
- `/giveaway stats` - View giveaway statistics
- `/giveaway info` - View specific giveaway details

**Admin Subcommands** (Permission required):
- `/giveaway create` - Create a new giveaway
- `/giveaway edit` - Edit active giveaway
- `/giveaway end` - End giveaway early
- `/giveaway reroll` - Reroll for new winners
- `/giveaway cancel` - Cancel giveaway
- `/giveaway set-creator-role` - Allow role to create giveaways
- `/giveaway remove-creator-role` - Remove creator role
- `/giveaway creator-roles` - List creator roles
- `/giveaway set-allowed-channel` - Allow channel for giveaways
- `/giveaway remove-allowed-channel` - Remove allowed channel
- `/giveaway settings` - View settings
- `/giveaway set-claim-period` - Set claim time

---

## 🔒 Permissions System

### Who Can Use Commands?

| Subcommand | Permission Required |
|------------|---------------------|
| **list, stats, info** | None (everyone) |
| **create** | Manage Server/Roles OR Creator Role |
| **edit, end, reroll, cancel** | Manage Server |
| **set-creator-role, remove-creator-role** | Manage Server |
| **creator-roles, settings** | None (everyone) |
| **set-allowed-channel, remove-allowed-channel** | Manage Server |
| **set-claim-period** | Manage Server |

### Default Security Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Min Account Age** | 7 days | Prevents alt account abuse |
| **Min Server Age** | 1 day | Requires server membership |
| **Exclude Bots** | Yes | Bots cannot enter |
| **Max Active Per User** | 3 | Rate limit for creators |
| **Claim Period** | 48 hours | Time to claim prize |
| **Channel Restrictions** | None | All channels allowed |

---

## 🎮 Usage Examples

### Create a Giveaway (Staff)
```
/giveaway create
  prize: Discord Nitro
  winners: 1
  duration: 24h
  description: Good luck everyone!
```

### View Active Giveaways (Everyone)
```
/giveaway list
```

### View Statistics (Everyone)
```
/giveaway stats
```

### Allow Event Hosts to Create Giveaways (Admin)
```
/giveaway set-creator-role role:@Event-Hosts
```

### Restrict Giveaways to Specific Channels (Admin)
```
/giveaway set-allowed-channel channel:#giveaways
```

### Edit Active Giveaway (Admin)
```
/giveaway edit
  giveaway-id: abc123
  prize: Discord Nitro Classic (updated!)
  winners: 2
```

---

## ⏱️ Duration Formats

| Format | Example | Duration |
|--------|---------|----------|
| `s` | `30s` | 30 seconds |
| `m` | `30m` | 30 minutes |
| `h` | `2h` | 2 hours |
| `d` | `7d` | 7 days |
| `w` | `2w` | 2 weeks |

**Limits:**
- Minimum: 1 minute
- Maximum: 28 days

---

## 🎯 Entry Requirements

Giveaways can enforce these requirements:

### 1. Role Requirements
Only users with specific roles can enter.
```
/giveaway create ... required-role:@Members
```

### 2. Account Age
Users' accounts must be older than X days (server-wide setting).
```
/giveaway settings → Min Account Age: 7 days
```

### 3. Server Age
Users must be members for X days (server-wide setting).
```
/giveaway settings → Min Server Age: 1 day
```

### 4. Bot Exclusion
Bot accounts are excluded by default (server-wide setting).

---

## 🎫 Bonus Entries

Users can receive bonus entries for:
- **Specific Roles**: Server boosters, VIPs, etc.
- **Server Boosters**: Automatic bonus for boosters

Configure in giveaway creation or server settings.

---

## 📊 Database Schema

### Giveaways Collection

```javascript
{
  _id: ObjectId,
  guildId: string,
  channelId: string,
  messageId: string,
  prize: string,
  winners: number,
  host: string, // User ID
  entries: [
    {
      userId: string,
      count: number,
      joinedAt: Date
    }
  ],
  requirements: {
    roles: [string], // Role IDs
    minAccountAge: number, // milliseconds
    minServerAge: number, // milliseconds
    excludeBots: boolean
  },
  bonusEntries: [
    {
      type: string, // 'role' or 'booster'
      roleId: string,
      entries: number
    }
  ],
  startTime: Date,
  endTime: Date,
  duration: number, // milliseconds
  status: string, // 'active', 'ended', 'completed', 'cancelled'
  winnersData: [
    {
      userId: string,
      selectedAt: Date,
      claimed: boolean,
      claimedAt: Date
    }
  ],
  description: string,
  color: number,
  thumbnail: string,
  claimPeriod: number, // hours
  createdAt: Date,
  updatedAt: Date
}
```

### Giveaway Settings Collection

```javascript
{
  guildId: string,
  creatorRoles: [string], // Roles that can create giveaways
  allowedChannels: [string], // Channels where giveaways allowed
  claimPeriod: number, // Hours (default: 48)
  logChannel: string, // Channel for logs
  requireAccountAge: number, // Days (default: 7)
  requireServerAge: number, // Days (default: 1)
  excludeBots: boolean, // Default: true
  maxActivePerUser: number, // Default: 3
  createdAt: Date,
  updatedAt: Date
}
```

---

## 📁 File Structure

```
src/
├── commands/general/giveaway/
│   ├── index.js              # Command definition (14 subcommands)
│   ├── handlers.js           # Command handlers
│   ├── embeds.js             # Embed builders
│   ├── components.js         # Button components
│   └── README.md             # This documentation
├── features/giveaway/
│   └── GiveawayManager.js    # Core logic & database operations
├── utils/giveaway/
│   └── utils.js              # Helper functions
└── events/
    └── giveaway.js           # Button interaction handlers
```

---

## 🏆 Winner Selection

Winners are selected using **weighted random selection**:

1. Each entry adds a "ticket" to the pool
2. Users with bonus entries have more tickets
3. Random selection without replacement
4. Same user can't win multiple times in same giveaway

**Anti-Cheat Measures:**
- Alt account detection (account age requirement)
- Bot account exclusion
- Server age verification
- Rate limiting per user

---

## 📈 Statistics

Track giveaway performance with `/giveaway stats`:

- Total giveaways created
- Active giveaways
- Completed giveaways
- Cancelled giveaways
- Total entries across all giveaways

---

## ⚠️ Troubleshooting

### Giveaway Not Ending
- Check bot has permissions in the channel
- Verify bot is online
- Check logs for errors

### Users Can't Enter
- Check requirements are met (age, roles, etc.)
- Verify bot has permission to read/send messages
- Ensure button interactions are working

### User Can't Create Giveaway
- Check user has proper permissions or creator role
- Verify rate limit not exceeded (max 3 active)
- Check channel is allowed for giveaways

### Permission Denied Error
- Most management commands require **Manage Server** permission
- Some commands allow **Creator Roles** (set by admins)
- Public commands (list, stats, info) work for everyone

---

## 📊 Industry Standard Comparison

| Feature | Our Bot | Industry Standard |
|---------|---------|-------------------|
| **Command Structure** | ✅ One command | ✅ One command |
| **Permission System** | ✅ Runtime checks | ✅ Runtime checks |
| **Custom Creator Roles** | ✅ Yes | ✅ Yes |
| **Rate Limiting** | ✅ Yes | ✅ Yes |
| **Channel Restrictions** | ✅ Yes | ✅ Yes |
| **Entry Requirements** | ✅ Yes | ✅ Yes |
| **Bot Exclusion** | ✅ Yes | ✅ Yes |
| **Account Age Check** | ✅ Yes | ✅ Yes |
| **Server Age Check** | ✅ Yes | ✅ Yes |
| **Edit Giveaway** | ✅ Yes | ✅ Yes |
| **Reroll** | ✅ Yes | ✅ Yes |
| **Auto DM Winners** | ✅ Yes | ✅ Yes |
| **Configurable Claim Period** | ✅ Yes | ✅ Yes |
| **Giveaway Logging** | ✅ Yes | ✅ Yes |
| **Bonus Entries** | ✅ Yes | ✅ Yes |

**Score: 15/15** - Matches or exceeds industry standards! ✅

---

## 💡 Best Practices

### For Server Owners
1. Set up a dedicated `#giveaways` channel
2. Add `@Event-Hosts` as creator role for trusted members
3. Enable account age requirement (7+ days)
4. Set claim period to 48-72 hours
5. Enable giveaway logging

### For Giveaway Creators
1. Be clear about prize details
2. Set reasonable duration (1-7 days recommended)
3. Use role requirements for targeted giveaways
4. Monitor entries for suspicious activity
5. Follow up with winners promptly

### For Participants
1. Check requirements before entering
2. Keep DMs open for winner notifications
3. Respond within claim period if you win
4. Report suspicious giveaways to staff

---

**Version:** 2.1.0 (Industry Standard Compliant)  
**Last Updated:** March 16, 2026  
**Author:** Role Reactor Bot Team  
**License:** MIT
