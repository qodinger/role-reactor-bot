# Setup Guide

## 🚀 Quick Start

### 1. Environment Setup

Copy the environment template and fill in your values:

```bash
# Basic setup (single .env file)
cp env.example .env

# Or use separate environment files (optional)
# Development environment
cp env.template.development .env.development

# Production environment
cp env.template.production .env.production
```

### 2. Edit Environment Files

#### Basic Setup (`.env`)

```bash
# Discord Bot Configuration
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here

# Database
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=role-reactor-bot
```

#### Advanced Setup (Separate Files)

If using separate development and production files:

**`.env.development`**

```bash
# Discord Bot Configuration
DISCORD_TOKEN=your_actual_dev_bot_token
CLIENT_ID=your_actual_dev_client_id
GUILD_ID=your_actual_dev_server_id

# Database
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=role-reactor-bot-dev
```

**`.env.production`**

```bash
# Discord Bot Configuration
DISCORD_TOKEN=your_actual_prod_bot_token
CLIENT_ID=your_actual_prod_client_id
# No GUILD_ID for global commands

# Database
MONGODB_URI=your_actual_prod_mongodb_uri
MONGODB_DB=role-reactor-bot-prod
```

### 3. Start the Bot

#### Development Mode

```bash
pnpm dev
```

#### Production Mode

```bash
pnpm start
```

### 4. Deploy Commands

#### Development (Guild-specific)

```bash
pnpm run deploy:dev
```

#### Production (Global)

```bash
pnpm run deploy:prod
```

## 🔐 Security Notes

- **Never commit** `.env.*` files to version control
- **Use different tokens** for development and production
- **Keep templates** in version control for easy setup
- **Rotate tokens** regularly for security

## 🐳 Docker Setup

### Development

```bash
pnpm run docker:dev
```

### Production

```bash
pnpm run docker:prod
```

## 📚 Additional Resources

- [Discord Developer Portal](https://discord.com/developers/applications)
- [MongoDB Setup](https://docs.mongodb.com/manual/installation/)
- [Environment Variables Best Practices](https://12factor.net/config)
