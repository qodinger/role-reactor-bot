# API Documentation

This document describes the Role Reactor Bot's API, commands, and internal structure.

## 🎯 Slash Commands

### `/setup-roles`

Creates a role-reaction message where users can self-assign roles.

**Parameters:**
- `title` (string, required): The title of the embed message
- `description` (string, required): The description of the embed message
- `roles` (string, required): Role-emoji mappings

**Role Format Examples:**
```
# Simple format
🎮:Gamer,🎨:Artist,💻:Developer

# With categories
#Gaming\n🎮:Gamer,🎲:Board Games\n#Music\n🎵:Music Lover

# Multiple categories
#Gaming|#Music\n🎮:Gamer|🎵:Music Lover
```

**Permissions Required:** Manage Roles

**Response:** Creates an embed message with reaction buttons

### `/remove-roles`

Removes role-reaction mappings from a message.

**Parameters:**
- `message_id` (string, required): The ID of the message to remove reactions from

**Permissions Required:** Manage Roles

**Response:** Removes all reactions and disables role assignment

### `/help`

Displays bot information and available commands.

**Parameters:** None

**Permissions Required:** None

**Response:** Shows bot information and command list

## 🎨 Embed Structure

### Role Message Embed

```javascript
{
  title: "Server Roles",
  description: "Choose your roles by reacting!",
  color: 0x0099ff,
  fields: [
    {
      name: "Gaming",
      value: "🎮 Gamer\n🎲 Board Games",
      inline: true
    },
    {
      name: "Music", 
      value: "🎵 Music Lover\n🎸 Guitarist",
      inline: true
    }
  ],
  footer: {
    text: "React to assign/remove roles"
  }
}
```

## 🔧 Internal API

### Role Manager

The bot uses a role manager to handle role assignments:

```javascript
// Role assignment
await roleManager.assignRole(userId, roleId, guildId);

// Role removal  
await roleManager.removeRole(userId, roleId, guildId);

// Check if user has role
const hasRole = await roleManager.userHasRole(userId, roleId, guildId);
```

### Permission Checker

Permission validation for administrative commands:

```javascript
// Check if user can manage roles
const canManageRoles = await permissionChecker.canManageRoles(member);

// Check if user can manage the target role
const canManageTargetRole = await permissionChecker.canManageRole(member, role);
```

### Reaction Parser

Parses role-emoji mappings from command input:

```javascript
// Parse role mappings
const mappings = reactionParser.parseRoleMappings(rolesString);

// Result structure:
[
  {
    emoji: "🎮",
    roleName: "Gamer",
    category: "Gaming"
  }
]
```

## 📡 Events

### Message Events

- `messageCreate`: Handles new messages
- `messageReactionAdd`: Handles role assignment
- `messageReactionRemove`: Handles role removal
- `messageDelete`: Cleans up when role messages are deleted

### Interaction Events

- `interactionCreate`: Handles slash command interactions
- `ready`: Bot startup and initialization

### Error Events

- `error`: Global error handling
- `warn`: Warning message handling

## 🗄️ Data Storage

### Role Mappings

Role mappings are stored in memory and persisted to:

```javascript
// File: src/config/role-mappings.json
{
  "messageId": {
    "guildId": "guild_id",
    "mappings": [
      {
        "emoji": "🎮",
        "roleId": "role_id",
        "roleName": "Gamer"
      }
    ]
  }
}
```

### Configuration

Bot configuration is stored in:

```javascript
// File: src/config/config.js
{
  defaultColor: 0x0099ff,
  maxRolesPerMessage: 20,
  maxCategoriesPerMessage: 5,
  logLevel: "info"
}
```

## 🔐 Security

### Permission Validation

All administrative commands validate:

1. **User Permissions**: Check if user has required permissions
2. **Role Hierarchy**: Ensure bot can manage target roles
3. **Guild Permissions**: Verify bot has required guild permissions
4. **Input Validation**: Sanitize and validate all inputs

### Rate Limiting

- **Command Cooldown**: 3 seconds between command uses
- **Reaction Processing**: Debounced to prevent spam
- **API Limits**: Respect Discord API rate limits

## 📊 Metrics

### Performance Metrics

- **Command Response Time**: <100ms target
- **Role Assignment Time**: <50ms target
- **Memory Usage**: <100MB baseline
- **CPU Usage**: <5% during idle

### Error Tracking

- **Command Errors**: Logged with context
- **Permission Errors**: User-friendly messages
- **API Errors**: Automatic retry with exponential backoff
- **Validation Errors**: Detailed error messages

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm run test:watch

# Run specific test file
pnpm test -- tests/commands/setup-roles.test.js
```

### Integration Tests

```bash
# Run integration tests
pnpm test -- --testPathPattern=integration

# Run with coverage
pnpm test -- --coverage
```

## 📝 Logging

### Log Levels

- **ERROR**: Critical errors that prevent operation
- **WARN**: Non-critical issues that should be addressed
- **INFO**: General operational information
- **DEBUG**: Detailed debugging information

### Log Format

```
[2024-01-15 10:30:45] [INFO] Bot started successfully
[2024-01-15 10:30:46] [INFO] Commands deployed to 1 guild
[2024-01-15 10:30:47] [DEBUG] Role mapping created: messageId=123456789
```

---

*For deployment information, see [Deployment Guide](./DEPLOYMENT.md)* 