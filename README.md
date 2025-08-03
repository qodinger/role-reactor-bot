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

#### Developer Commands

| Command        | Description                                  | Permissions |
| -------------- | -------------------------------------------- | ----------- |
| `/health`      | 🔒 [DEVELOPER ONLY] Check bot health status  | Developer   |
| `/performance` | 🔒 [DEVELOPER ONLY] View performance metrics | Developer   |
| `/storage`     | 🔒 [DEVELOPER ONLY] Show storage status      | Developer   |

#### General Commands

| Command    | Description                  | Permissions |
| ---------- | ---------------------------- | ----------- |
| `/help`    | Display bot information      | None        |
| `/ping`    | Check bot latency and status | None        |
| `/invite`  | Get bot invite link          | None        |
| `/support` | Get support server link      | None        |

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

- **Manage Roles**: To assign/remove roles
- **Manage Messages**: To add reactions
- **Add Reactions**: To add emoji reactions
- **Read Message History**: To access reaction events
- **View Channel**: To read channel content

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

## 📖 Documentation

- **[🚀 Deployment Guide](./DEPLOYMENT.md)** - Production deployment instructions
- **[🤝 Contributing Guidelines](./CONTRIBUTING.md)** - How to contribute to the project

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for detailed information.

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

## 📜 Legal Information

- **Terms of Use**: [docs/legal/terms-of-use.md](docs/legal/terms-of-use.md)
- **Privacy Policy**: [docs/legal/privacy-policy.md](docs/legal/privacy-policy.md)

## 🆘 Support

- **GitHub Issues**: [Create an issue](https://github.com/tyecode-bots/role-reactor-bot/issues)
- **Documentation**: [Deployment Guide](./DEPLOYMENT.md)
- **Contributing**: [Contributing Guidelines](./CONTRIBUTING.md)

---

**Made with ❤️ by [Tyecode](https://github.com/tyecode)**
