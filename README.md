# Role Reactor Bot

<div align="center">
  <img src="./assets/banner.png" alt="Role Reactor Bot - React for Roles!" width="100%">
</div>

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/) [![Discord.js](https://img.shields.io/badge/Discord.js-14.22.1-blue.svg)](https://discord.js.org/) [![License](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE) [![Documentation](https://img.shields.io/badge/Documentation-rolereactor.xyz-blue.svg)](https://rolereactor.xyz/docs)

</div>

---

A powerful Discord bot for server management with role assignment, AI features, moderation tools, and community engagement. Built with Discord.js v14, featuring enterprise-grade logging, health monitoring, and scalable MongoDB integration.

## 📋 Table of Contents

- [Features](#-features)
- [Commands](#-commands)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [Production Deployment](#-production-deployment)
- [Pro Engine](#-pro-engine)
- [Documentation](#-documentation)
- [Contributing](#-contributing)

## ✨ Features

- **🎯 Self-Assignable Roles**: Users can assign/remove roles by reacting to messages
- **📦 Role Bundles**: Create reusable groups of roles for role-reaction setups
- **⏰ Temporary Roles**: Auto-expire roles after a set time with smart notifications
- **📅 Schedule Roles**: Schedule automatic role assignments with one-time or recurring schedules
- **🎁 Giveaway System**: Full-featured giveaways with bonus entries, claim periods, and rerolling
- **🎉 Welcome System**: Auto-welcome new members with customizable messages and auto-role
- **👋 Goodbye System**: Auto-goodbye messages when members leave
- **🛡️ Moderation System**: Bulk timeout, warn, ban, kick, purge, and history tracking
- **⭐ Starboard System**: Highlight the best messages with a community-driven hall of fame
- **🎫 Ticket System**: Complete support ticket system with panels, transcripts, and lifecycle management
- **🎙️ Voice Control**: Automatically manage users in voice channels based on roles
- **📊 XP System**: Configurable experience system with level progression and leaderboards
- **📊 Poll System**: Create and manage native Discord polls
- **💎 Core Credit System**: Credit-based economy with crypto payment integration
- **🗳️ Voting Rewards**: Earn Core Credits by voting on top.gg

## 📋 Commands

### Admin Commands

| Command | Description |
|---------|-------------|
| `/role-reactions` | Setup, list, delete, and update reaction role menus |
| `/role-bundle` | Create, delete, list, and view reusable role bundles |
| `/temp-roles` | Assign, list, and remove temporary roles |
| `/schedule-role` | Create, list, view, cancel, and delete scheduled roles |
| `/giveaway` | Create, list, end, reroll, cancel, and edit giveaways |
| `/welcome` | Setup and configure welcome messages |
| `/goodbye` | Setup and configure goodbye messages |
| `/moderation` | Timeout, warn, ban, kick, purge, and view history |
| `/ticket` | Setup and manage support ticket system |
| `/voice-roles` | Manage auto voice channel role assignments |
| `/xp` | Configure XP settings, rewards, and level roles |
| `/starboard` | Setup and configure the starboard feature |
| `/automod` | Configure auto-moderation filters |
| `/dashboard` | Open the server dashboard |

### General Commands

| Command | Description |
|---------|-------------|
| `/help` | Get help and information about bot commands |
| `/ping` | Check bot latency and connection status |
| `/invite` | Get the bot's invite link |
| `/support` | Get support and help information |
| `/level` | View your current level and XP progress |
| `/leaderboard` | View the XP leaderboard |
| `/balance` | Check your Core Credits balance and send to others |
| `/engine` | Manage Pro Engine status and vault |
| `/premium` | View Pro Engine features, start trial, or upgrade |
| `/vote` | Vote on top.gg and earn rewards |
| `/poll` | Create, list, end, and delete polls |
| `/avatar` | Generate AI anime-style avatars |
| `/rps` | Challenge someone to Rock Paper Scissors |
| `/8ball` | Ask the magic 8-ball |
| `/wyr` | Get a random "Would You Rather" question |
| `/userinfo` | Display detailed user information |
| `/serverinfo` | Display detailed server information |
| `/stats` | View bot statistics and usage |

## 🚀 Quick Start

### Prerequisites

- Node.js 22 or higher
- pnpm 9.9.0 or higher
- MongoDB (local or Atlas)
- Discord Bot Token

### Installation

```bash
git clone https://github.com/rolereactor/bot.git
cd bot
pnpm install
cp env.example .env
```

Edit `.env` with your configuration:

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
MONGODB_URI=mongodb://localhost:27017
```

Deploy slash commands and start:

```bash
pnpm run deploy:prod  # Production (excludes dev commands)
pnpm start
```

### Docker

```bash
pnpm run docker:build   # Build image
pnpm run docker:prod    # Start with Docker Compose
pnpm run docker:logs    # View logs
```

## 🔧 Configuration

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DISCORD_TOKEN` | Discord bot token | Yes | - |
| `DISCORD_CLIENT_ID` | Discord application client ID | Yes | - |
| `DISCORD_GUILD_ID` | Target guild ID (for dev) | No | - |
| `DISCORD_DEVELOPERS` | Developer user IDs (comma-separated) | No | - |
| `MONGODB_URI` | MongoDB connection URI | No | `mongodb://localhost:27017` |
| `MONGODB_DB` | MongoDB database name | No | `role-reactor-bot` |
| `LOG_LEVEL` | Log level (ERROR, WARN, INFO, DEBUG) | No | `INFO` |

## 🚀 Production Deployment

Production runs on a VPS with Caddy handling SSL:

```
Internet → Caddy (SSL + api.rolereactor.xyz) → Docker container:3030
```

```bash
pnpm run docker:deploy    # Pull, build, and start
pnpm run docker:logs      # View logs
```

See the [Deployment Guide](./docs/setup/deployment.md) for full setup.

## 💎 Pro Engine

Upgrade your server with **Pro Engine** for enhanced limits:

| Feature | Free Tier | Pro Engine |
|:--------|:----------|:-----------|
| Giveaway Entries | 2,500 | **10,000** |
| Giveaway Winners | 5 | **10** |
| Giveaway Active | 3 | **20** |
| Scheduled Roles | 25 active | **100 active** |
| Temp Roles | 25 active | **100 active** |
| Role Bundles | 5 roles | **20 roles** |
| Role Reactions | 10 emojis, 5 menus | **20 emojis, 15 menus** |
| XP Rewards | 5 (Stack) | **Unlimited** |
| Ticket Transcripts | Text | **HTML/JSON** |

See [Core Energy Guide](./docs/CORE_ENERGY.md) for details.

## 📖 Documentation

- [Command Reference](https://rolereactor.xyz/docs)
- [Deployment Guide](./docs/setup/deployment.md)
- [Core Energy & Pro Engine](./docs/CORE_ENERGY.md)
- [Contributing Guidelines](./docs/CONTRIBUTING.md)

## 🤝 Contributing

See [Contributing Guidelines](./docs/CONTRIBUTING.md).

```bash
pnpm install
pnpm dev
pnpm lint
pnpm test
```

## 🔒 Security

- **Multi-Layer Authentication**: Discord OAuth + API key + guild permission verification
- **Rate Limiting**: Prevents abuse of sensitive endpoints
- **Audit Logging**: All API requests logged with user context
- **Input Validation**: Strict validation on all API inputs

To report a security issue, contact us privately before public disclosure.

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later) — see the [LICENSE](LICENSE) file for details.

In short: you are free to use, study, modify, and self-host this bot, but if you offer it (modified or not) as a network service, you must release your modified source code under the same license. For commercial licensing inquiries, contact us.
