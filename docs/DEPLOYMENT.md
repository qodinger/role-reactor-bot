# Deployment Guide

This guide covers different deployment methods for the Role Reactor Bot.

## 🚀 Deployment Options

### 1. PM2 Deployment (Recommended)

PM2 is the recommended deployment method for production environments.

**Quick Start:**
```bash
# Install PM2 globally
pnpm add -g pm2

# Start in production mode
pnpm run pm2:start:prod

# Check status
pnpm run pm2:status
```

**For detailed PM2 instructions, see [PM2 Guide](./PM2_GUIDE.md)**

### 2. Manual Deployment

For simple setups or development environments:

```bash
# Install dependencies
pnpm install

# Set environment variables
cp env.example .env
# Edit .env with your Discord token

# Deploy commands
pnpm run deploy-commands

# Start the bot
pnpm start
```

### 3. Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Expose port (if needed)
EXPOSE 3000

# Start the bot
CMD ["pnpm", "start"]
```

**Build and run:**
```bash
docker build -t role-reactor-bot .
docker run -d --name role-reactor-bot role-reactor-bot
```

## 🔧 Environment Setup

### Required Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_TOKEN` | Discord bot token | Yes |
| `CLIENT_ID` | Discord application client ID | Yes |
| `GUILD_ID` | Target guild ID (development) | No |
| `NODE_ENV` | Environment (production/development) | No |

### Environment File Setup

1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` with your Discord bot credentials:
   ```env
   DISCORD_TOKEN=your_discord_bot_token_here
   CLIENT_ID=your_discord_application_client_id
   GUILD_ID=your_guild_id_for_development
   NODE_ENV=production
   ```

## 🛡️ Security Considerations

### Production Security

1. **Environment Variables**: Never commit `.env` files to version control
2. **Bot Permissions**: Use minimal required permissions
3. **Token Security**: Keep your Discord token secure
4. **Network Security**: Use HTTPS in production
5. **Logging**: Avoid logging sensitive information

### Bot Permissions

Ensure your bot has these permissions:
- **Manage Roles**: To assign/remove roles
- **Manage Messages**: To add reactions
- **Add Reactions**: To add emoji reactions
- **Read Message History**: To access reaction events
- **View Channel**: To read channel content

## 📊 Monitoring

### PM2 Monitoring

```bash
# View real-time logs
pnpm run pm2:logs

# Open monitoring dashboard
pnpm run pm2:monit

# Check process status
pnpm run pm2:status
```

### Health Checks

Monitor these metrics:
- **Memory Usage**: Should stay under 100MB
- **CPU Usage**: Should be low during idle
- **Response Time**: Role operations should be <100ms
- **Uptime**: Target 99.9% availability

## 🔄 Updates and Maintenance

### Updating the Bot

```bash
# Pull latest changes
git pull origin main

# Install updated dependencies
pnpm install

# Deploy updated commands
pnpm run deploy-commands

# Restart the bot
pnpm run pm2:restart
```

### Backup and Recovery

1. **Backup Configuration**:
   ```bash
   # Save PM2 process list
   pnpm run pm2:save
   
   # Backup environment files
   cp .env .env.backup
   ```

2. **Recovery**:
   ```bash
   # Restore PM2 processes
   pnpm run pm2:resurrect
   
   # Restore environment
   cp .env.backup .env
   ```

## 🚨 Troubleshooting

### Common Issues

**Bot not starting:**
```bash
# Check logs
pnpm run pm2:logs

# Verify environment variables
pm2 show role-reactor-bot
```

**Commands not working:**
```bash
# Redeploy commands
pnpm run deploy-commands

# Check bot permissions
# Ensure bot has required permissions in Discord
```

**High memory usage:**
```bash
# Monitor memory usage
pnpm run pm2:monit

# Check for memory leaks
pm2 show role-reactor-bot
```

### Support

- **Documentation**: [Main Documentation](./README.md)
- **Issues**: [GitHub Issues](https://github.com/tyecode/role-reactor-bot/issues)
- **Discord**: [Support Server](https://discord.gg/rolereactor)

---

*For PM2-specific deployment, see [PM2 Guide](./PM2_GUIDE.md)* 