# Role Reactor Bot

<div align="center">
  <img src="./assets/banner.png" alt="Role Reactor Bot - React for Roles!" width="600">
</div>

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/) [![Discord.js](https://img.shields.io/badge/Discord.js-14.14.1-blue.svg)](https://discord.js.org/) [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![GitBook](https://img.shields.io/static/v1?message=Documented%20on%20GitBook&logo=gitbook&logoColor=ffffff&label=%20&labelColor=5c5c5c&color=3F89A1)](https://www.gitbook.com/preview?utm_source=gitbook_readme_badge&utm_medium=organic&utm_campaign=preview_documentation&utm_content=link)

</div>

---

A production-ready Discord bot for self-assignable roles through reactions. Built with Discord.js v14, featuring enterprise-grade logging, health monitoring, and scalable MongoDB integration.

## ✨ Features

- **🎯 Self-Assignable Roles**: Users can assign/remove roles by reacting to messages
- **⏰ Temporary Roles**: Auto-expire roles after a set time with smart notifications
- **🚀 Schedule Role System**: Schedule future role assignments with natural language parsing
- **🔄 Recurring Roles**: Create daily, weekly, monthly, or custom interval schedules
- **🎉 Welcome System**: Auto-welcome new members with customizable messages and auto-role assignment
- **🧠 Smart 8ball**: Intelligent question analysis with sentiment detection and context-aware responses
- **📊 XP System**: Configurable experience system with level progression and leaderboards
- **👤 User Information**: Avatar display, server info, and user statistics
- **🛡️ Permission Controls**: Comprehensive permission checking
- **🎨 Custom Emojis**: Support for Unicode and custom server emojis
- **📊 Role Categories**: Organize roles into logical groups
- **🔧 Easy Setup**: Simple slash commands for configuration
- **📈 Health Monitoring**: Built-in health checks and performance metrics
- **📝 Structured Logging**: Enterprise-grade logging with file output
- **🎨 User-Friendly UI**: Clean, concise, and helpful messaging with interactive buttons
- **🔗 Centralized Links**: Consistent external links and invite generation

## 🚀 Quick Start

### Prerequisites

- Node.js 16.0.0 or higher
- pnpm package manager
- MongoDB (local or Atlas)
- Discord Bot Token

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/qodinger/role-reactor-bot.git
   cd role-reactor-bot
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Configure environment variables**

   ```bash
   cp env.example .env
   ```

   Edit `.env` with your configuration:

   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   MONGODB_URI=mongodb://localhost:27017
   ```

4. **Deploy slash commands**

   ```bash
   # Development (includes developer commands)
   pnpm run deploy:dev

   # Production (excludes developer commands)
   pnpm run deploy:prod
   ```

5. **Start the bot**
   ```bash
   pnpm start
   ```

## 📖 Usage

### Setting Up Role Reactions

Create role-reaction messages using the `/role-reactions setup` command:

**Simple format:**

```
/role-reactions setup title:"Server Roles" description:"Choose your roles by reacting!" roles:"🎮 @Gamer,🎨 @Artist,💻 @Developer"
```

**With categories:**

```
/role-reactions setup title:"Server Roles" description:"Choose your roles by reacting!" roles:"#Gaming\n🎮 @Gamer,🎲 @Board Games\n#Music\n🎵 @Music Lover,🎸 @Guitarist"
```

**Manage existing role-reaction messages:**

```
/role-reactions list
/role-reactions update message_id:"1234567890" title:"Updated Title"
/role-reactions delete message_id:"1234567890"
```

### Temporary Roles

Assign temporary roles that auto-expire with smart notifications:

**Assign a temporary role:**

```
/temp-roles assign users:"@username" role:@EventRole duration:"2h" reason:"Event participation" notify-expiry:true
```

**Bulk assignment:**

```
/temp-roles assign users:"@user1, @user2, @user3" role:@VIP duration:"1d" reason:"Event access"
```

**Manage temporary roles:**

```
/temp-roles list
/temp-roles list user:@username
/temp-roles remove users:"@username" role:@EventRole
```

**Duration formats:**

- `30m` - 30 minutes
- `2h` - 2 hours
- `1d` - 1 day
- `1w` - 1 week

### Schedule Role System

Schedule future role assignments with natural language parsing:

**One-time schedules:**

```
/schedule-role create users:"@username" role:@EventRole type:"one-time" schedule:"tomorrow 9am" duration:"2h" reason:"Event access"
/schedule-role create users:"@user1, @user2" role:@VIP type:"one-time" schedule:"friday 6pm" duration:"1d"
```

**Recurring schedules:**

```
/schedule-role create users:"@username" role:@WeeklyRole type:"weekly" schedule:"monday 9am" duration:"1d"
/schedule-role create users:"@username" role:@MonthlyRole type:"monthly" schedule:"1st 10am" duration:"2h"
```

**Manage schedules:**

```
/schedule-role list
/schedule-role view id:"2802a998...7f7a"
/schedule-role cancel id:"2802a998...7f7a"
```

**Schedule types:**

- `one-time` - Single assignment at specified time
- `daily` - Every day at specified time
- `weekly` - Every week on specified day/time
- `monthly` - Every month on specified day/time
- `custom` - Custom interval (e.g., every 3 days)

**Natural language examples:**

- `"tomorrow 9am"` - Tomorrow at 9:00 AM
- `"monday 6pm"` - Next Monday at 6:00 PM
- `"15 2pm"` - 15th of this month at 2:00 PM
- `"120"` - In 120 minutes

### Welcome System

Automatically welcome new members with customizable messages and auto-role assignment:

**Setup welcome system:**

```
/setup-welcome channel:#welcome message:"Welcome {user} to {server}! You are member #{memberCount.ordinal}!" auto-role:@Member enabled:true embed:true
```

**View settings:**

```
/welcome-settings
```

**Available placeholders:**

- `{user}` - User mention
- `{user.name}` - Username
- `{user.tag}` - User tag
- `{server}` - Server name
- `{memberCount}` - Member count
- `{memberCount.ordinal}` - Ordinal member count

### XP System Configuration

The XP system is **disabled by default** and must be enabled by server administrators. When enabled, users can earn XP through:

- **Messages**: 15-25 XP every 60 seconds
- **Commands**: 3-15 XP every 30 seconds (varies by command)
- **Role Assignments**: 50 XP per role

**Admin Commands:**

- `/xp-settings` - View current XP system status and toggle features

**Default Settings:**

- System: Disabled
- Message XP: 15-25 XP (60s cooldown)
- Command XP: 8 XP base + bonuses (30s cooldown)
- Role XP: 50 XP per role

**Note:** XP system configuration is now simplified with button-driven toggles. All settings use optimized default values that work well for most servers.

### General Commands

**Smart 8ball with intelligent responses:**

```
/8ball question:"Will I pass my exam?"
/8ball question:"How do I learn programming?"
```

**User information and statistics:**

```
/avatar user:@username
/serverinfo
/level user:@username
/leaderboard
```

**Bot information and support:**

```
/help
/ping
/invite
/support
/sponsor
```

### Available Commands

#### Server Management Commands

| Command                  | Description                              | Permissions   |
| ------------------------ | ---------------------------------------- | ------------- |
| `/role-reactions setup`  | Create a role-reaction message           | Manage Roles  |
| `/role-reactions list`   | List all role-reaction messages          | Manage Roles  |
| `/role-reactions update` | Update an existing role-reaction message | Manage Roles  |
| `/role-reactions delete` | Delete a role-reaction message           | Manage Roles  |
| `/temp-roles assign`     | Assign temporary roles (supports bulk)   | Manage Roles  |
| `/temp-roles list`       | List temporary roles                     | Manage Roles  |
| `/temp-roles remove`     | Remove temporary roles (supports bulk)   | Manage Roles  |
| `/schedule-role create`  | Schedule future role assignments         | Manage Roles  |
| `/schedule-role list`    | List scheduled and recurring roles       | Manage Roles  |
| `/schedule-role view`    | View details of a specific schedule      | Manage Roles  |
| `/schedule-role cancel`  | Cancel a scheduled or recurring role     | Manage Roles  |
| `/setup-welcome`         | Configure welcome system                 | Manage Server |
| `/welcome-settings`      | View welcome system settings             | Manage Server |
| `/xp-settings`           | View and manage XP system settings       | Manage Server |

#### Developer Commands

| Command        | Description                                  | Permissions |
| -------------- | -------------------------------------------- | ----------- |
| `/health`      | 🔒 [DEVELOPER ONLY] Check bot health status  | Developer   |
| `/performance` | 🔒 [DEVELOPER ONLY] View performance metrics | Developer   |
| `/storage`     | 🔒 [DEVELOPER ONLY] Show storage status      | Developer   |

#### General Commands

| Command        | Description                                    | Permissions |
| -------------- | ---------------------------------------------- | ----------- |
| `/help`        | Display comprehensive bot help and information | None        |
| `/ping`        | Check bot latency and status                   | None        |
| `/invite`      | Get bot invite link with proper permissions    | None        |
| `/support`     | Get support server and GitHub links            | None        |
| `/sponsor`     | Support bot development (donations)            | None        |
| `/8ball`       | Ask the magic 8ball with intelligent responses | None        |
| `/avatar`      | Display user avatar in high resolution         | None        |
| `/serverinfo`  | Display detailed server information            | None        |
| `/level`       | Check user XP level and statistics             | None        |
| `/leaderboard` | View server XP leaderboard                     | None        |

## 🔧 Configuration

### Environment Variables

| Variable        | Description                          | Required | Default                     |
| --------------- | ------------------------------------ | -------- | --------------------------- |
| `DISCORD_TOKEN` | Discord bot token                    | Yes      | -                           |
| `CLIENT_ID`     | Discord application client ID        | Yes      | -                           |
| `MONGODB_URI`   | MongoDB connection URI               | No       | `mongodb://localhost:27017` |
| `MONGODB_DB`    | MongoDB database name                | No       | `role-reactor-bot`          |
| `LOG_LEVEL`     | Log level (ERROR, WARN, INFO, DEBUG) | No       | `INFO`                      |
| `LOG_FILE`      | Log file path                        | No       | Console only                |
| `LOG_CONSOLE`   | Enable console logging               | No       | `true`                      |
| `DEVELOPERS`    | Developer user IDs                   | No       | -                           |

### Bot Permissions

Required Discord bot permissions:

- **Manage Roles**: To assign/remove roles and auto-roles
- **Manage Messages**: To add reactions
- **Add Reactions**: To add emoji reactions
- **Read Message History**: To access reaction events
- **View Channel**: To read channel content
- **Send Messages**: To send welcome messages

## 🚀 Production Deployment

### Docker Deployment (Recommended)

```bash
# Build and start production container
pnpm docker:build
pnpm docker:prod

# View logs
pnpm docker:logs

# Update deployment
pnpm docker:update
```

### Developer Setup

To use developer commands (`/health`, `/performance`, `/storage`), configure developers:

1. **Find your Discord User ID** (enable Developer Mode, right-click username, Copy ID)
2. **Add to `.env` file:**
   ```env
   DEVELOPERS=123456789012345678
   ```
3. **Restart the bot**

**Note:** Developer commands are hidden from Discord UI but accessible to authorized developers via runtime permission checks.

## 📊 Monitoring

### Health Checks

The bot includes comprehensive health monitoring:

- **Database connectivity** checks
- **Memory usage** monitoring
- **Performance metrics** tracking
- **Error rate** monitoring
- **Uptime** tracking

### Commands

- `/health` - 🔒 [DEVELOPER ONLY] Check bot health status
- `/performance` - 🔒 [DEVELOPER ONLY] View performance metrics
- `/storage` - 🔒 [DEVELOPER ONLY] Show storage status

## 🎨 User Experience

### Recent Improvements

- **🧠 Smart 8ball**: Intelligent question analysis with sentiment detection and context-aware responses
- **📅 Schedule Role System**: Natural language scheduling with recurring role assignments
- **🔄 Bulk Operations**: Multi-user support for temporary role assignments and removals
- **🎨 Modern UI**: Redesigned embeds with interactive buttons and better visual hierarchy
- **📝 Enhanced Help**: Comprehensive help system with autocomplete and interactive navigation
- **🔗 Interactive Buttons**: Direct links to support server, GitHub, and sponsor pages
- **⚡ Real-time Updates**: XP settings and other interfaces update in place instead of sending new messages
- **🛡️ Better Error Handling**: Clear, actionable error messages with troubleshooting tips
- **📱 Mobile-Friendly**: Optimized for both desktop and mobile Discord clients

### Command Features

- **Interactive Help**: Dropdown menus, buttons, and autocomplete for easy navigation
- **Smart Responses**: Context-aware 8ball responses based on question analysis
- **Bulk Management**: Multi-user operations for efficient role management
- **Natural Language**: Human-readable time formats for scheduling
- **Permission Checks**: Automatic permission validation with helpful feedback
- **Error Recovery**: Graceful error handling with retry mechanisms
- **Performance Tips**: Contextual advice based on connection status

## 📖 Documentation

- **[🚀 Deployment Guide](./docs/DEPLOYMENT.md)** - Production deployment instructions
- **[🤝 Contributing Guidelines](./docs/CONTRIBUTING.md)** - How to contribute to the project

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](./docs/CONTRIBUTING.md) for detailed information.

### Quick Development Setup

```bash
# Install dependencies
pnpm install

# Start development mode
pnpm dev

# Run linting
pnpm lint

# Run tests
pnpm test
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ by [Tyecode](https://github.com/tyecode)**
