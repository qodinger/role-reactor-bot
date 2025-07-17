# Role Reactor Bot 🤖

[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/) [![Discord.js](https://img.shields.io/badge/Discord.js-14.14.1-blue.svg)](https://discord.js.org/) [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-ready Discord bot for self-assignable roles through reactions. Built with Discord.js v14, featuring enterprise-grade logging, health monitoring, and scalable MongoDB integration.

## ✨ Features

- **🎯 Self-Assignable Roles**: Users can assign/remove roles by reacting to messages
- **⏰ Temporary Roles**: Auto-expire roles after a set time
- **🛡️ Permission Controls**: Comprehensive permission checking
- **🎨 Custom Emojis**: Support for Unicode and custom server emojis
- **📊 Role Categories**: Organize roles into logical groups
- **🔧 Easy Setup**: Simple slash commands for configuration
- **📈 Health Monitoring**: Built-in health checks and performance metrics
- **📝 Structured Logging**: Enterprise-grade logging with file output

## 🚀 Quick Start

### Prerequisites

- Node.js 16.0.0 or higher
- pnpm package manager
- MongoDB (local or Atlas)
- Discord Bot Token

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/tyecode-bots/role-reactor-bot.git
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
   pnpm run deploy-commands
   ```

5. **Start the bot**
   ```bash
   pnpm start
   ```

## 📖 Documentation

- **[🚀 Deployment Guide](./docs/DEPLOYMENT.md)** - Production deployment instructions and monitoring
- **[🤝 Contributing Guidelines](./docs/CONTRIBUTING.md)** - How to contribute to the project

## 📖 Usage

### Setting Up Role Reactions

Create role-reaction messages using the `/setup-roles` command:

**Simple format:**

```
/setup-roles title:"Server Roles" description:"Choose your roles by reacting!" roles:"🎮:Gamer,🎨:Artist,💻:Developer"
```

**With categories:**

```
/setup-roles title:"Server Roles" description:"Choose your roles by reacting!" roles:"#Gaming\n🎮:Gamer,🎲:Board Games\n#Music\n🎵:Music Lover,🎸:Guitarist"
```

### Temporary Roles

Assign temporary roles that auto-expire:

**Assign a temporary role:**

```
/assign-temp-role user:@username role:@EventRole duration:"2h" reason:"Event participation"
```

**Duration formats:**

- `30m` - 30 minutes
- `2h` - 2 hours
- `1d` - 1 day
- `1w` - 1 week

### Available Commands

#### Server Management Commands

| Command             | Description                     | Permissions  |
| ------------------- | ------------------------------- | ------------ |
| `/setup-roles`      | Create a role-reaction message  | Manage Roles |
| `/update-roles`     | Update an existing message      | Manage Roles |
| `/delete-roles`     | Delete a role-reaction message  | Manage Roles |
| `/list-roles`       | List all role-reaction messages | Manage Roles |
| `/assign-temp-role` | Assign a temporary role         | Manage Roles |
| `/list-temp-roles`  | List temporary roles            | Manage Roles |
| `/remove-temp-role` | Remove a temporary role         | Manage Roles |

#### Bot Management Commands

| Command        | Description              | Permissions         |
| -------------- | ------------------------ | ------------------- |
| `/health`      | Check bot health status  | Bot Owner/Developer |
| `/performance` | View performance metrics | Bot Owner/Developer |

#### General Commands

| Command | Description             | Permissions |
| ------- | ----------------------- | ----------- |
| `/help` | Display bot information | None        |

## 🏗️ Architecture

```
src/
├── commands/          # Slash command handlers
│   ├── admin/        # Server administrative commands
│   ├── bot-owner/    # Bot management commands
│   └── general/      # General commands
├── events/           # Discord event listeners
├── utils/            # Utility functions
│   ├── logger.js     # Structured logging
│   ├── healthCheck.js # Health monitoring
│   ├── databaseManager.js # MongoDB integration
│   └── ...          # Other utilities
├── config/           # Configuration files
└── index.js          # Bot entry point
```

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
| `BOT_OWNERS`    | Bot owner/developer user IDs         | No       | -                           |

### Bot Permissions

Required Discord bot permissions:

- **Manage Roles**: To assign/remove roles
- **Manage Messages**: To add reactions
- **Add Reactions**: To add emoji reactions
- **Read Message History**: To access reaction events
- **View Channel**: To read channel content

## 🗄️ Database

The bot uses **MongoDB** for data storage:

- **Document-based storage** perfect for Discord bot data
- **Horizontal scaling** for many servers and users
- **Cloud-ready** with MongoDB Atlas support

**Setup options:**

- **Local MongoDB**: `mongodb://localhost:27017`
- **MongoDB Atlas**: `mongodb+srv://username:password@cluster.mongodb.net`
- **Docker**: `mongodb://mongodb:27017`

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

### PM2 Deployment

```bash
# Install PM2
npm install -g pm2

# Start the bot
pm2 start src/index.js --name role-reactor-bot

# Monitor
pm2 monit
```

### Environment Setup

1. **Create production `.env` file**
2. **Set up MongoDB** (local or Atlas)
3. **Configure bot owners** (see Bot Owner Setup below)
4. **Deploy slash commands** globally
5. **Start the bot** with your preferred method
6. **Monitor health** with `/health` command

### Bot Owner Setup

To use bot management commands (`/health`, `/performance`), you need to configure bot owners:

#### Step 1: Find Your Discord User ID

1. **Open Discord** (desktop app or web)
2. **Go to User Settings** (gear icon in bottom left)
3. **Scroll down and click 'Advanced'**
4. **Enable 'Developer Mode'** (toggle switch)
5. **Go to any channel or server**
6. **Right-click your username**
7. **Select 'Copy ID'** from the context menu

Your User ID will look like: `123456789012345678` (17-19 digits)

#### Step 2: Add to Environment Variables

Add your User ID to your `.env` file:

```env
BOT_OWNERS=123456789012345678
```

**For multiple bot owners**, separate with commas:

```env
BOT_OWNERS=123456789012345678,987654321098765432
```

#### Step 3: Restart the Bot

After adding the `BOT_OWNERS` variable, restart your bot for the changes to take effect.

#### Troubleshooting

If you can't find your User ID:

- Make sure Developer Mode is enabled
- Try right-clicking your username in different places
- Check if you're using the latest Discord version
- If using Discord web, try the desktop app instead

## 📊 Monitoring

### Health Checks

The bot includes comprehensive health monitoring:

- **Database connectivity** checks
- **Memory usage** monitoring
- **Performance metrics** tracking
- **Error rate** monitoring
- **Uptime** tracking

### Logging

Enterprise-grade structured logging:

- **Multiple log levels**: ERROR, WARN, INFO, DEBUG, SUCCESS
- **File output** for persistence
- **Performance tracking** for commands and events
- **Error context** with stack traces

### Commands

- `/health` - Check bot health status
- `/performance` - View performance metrics

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

## 🆘 Support

- **GitHub Issues**: [Create an issue](https://github.com/tyecode-bots/role-reactor-bot/issues)
- **Documentation**: [Deployment Guide](./docs/DEPLOYMENT.md)
- **Contributing**: [Contributing Guidelines](./docs/CONTRIBUTING.md)
- **Repository**: [GitHub Repository](https://github.com/tyecode-bots/role-reactor-bot)

---

**Made with ❤️ by [Tyecode](https://github.com/tyecode)**
