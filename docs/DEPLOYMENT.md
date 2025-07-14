# Deployment Guide

## 🚀 Production Deployment

### Quick Start

```bash
# Build and start production container
pnpm docker:build
pnpm docker:prod

# Check status
docker ps | grep role-reactor-bot

# View logs
pnpm docker:logs
```

### Environment Setup

1. **Create `.env` file**
   ```env
   DISCORD_TOKEN=your_bot_token
   CLIENT_ID=your_client_id
   MONGODB_URI=mongodb://localhost:27017
   LOG_LEVEL=INFO
   ```

2. **Deploy slash commands**
   ```bash
   pnpm run deploy-commands
   ```

3. **Start the bot**
   ```bash
   pnpm docker:prod
   ```

## 🔄 Update Workflows

### Code Updates
```bash
# Full update (stop, rebuild, restart)
pnpm docker:update
```

### Configuration Updates
```bash
# Restart with new config
pnpm docker:restart:prod
```

### Emergency Restart
```bash
# Quick restart
pnpm docker:restart:prod
```

## 📊 Monitoring

### Health Checks
```bash
# Container status
docker ps | grep role-reactor-bot

# Resource usage
docker stats role-reactor-bot

# Recent logs
docker logs role-reactor-bot --tail 20
```

### Bot Commands
- `/health` - Check bot health status
- `/performance` - View performance metrics

### Log Analysis
```bash
# Follow logs in real-time
docker logs -f role-reactor-bot

# Search for errors
docker logs role-reactor-bot | grep -i error

# Search for specific events
docker logs role-reactor-bot | grep "messageDelete"
```

## 🛠️ Development

### Development Mode
```bash
# Start development with live reload
pnpm docker:dev

# View development logs
pnpm docker:dev:logs

# Stop development
pnpm docker:dev:down
```

### Local Testing
```bash
# Build and test locally
pnpm docker:build
pnpm docker:run
```

## 📋 Command Reference

### Production Commands
- `pnpm docker:prod` - Start production container
- `pnpm docker:restart:prod` - Restart production container
- `pnpm docker:update` - Full update (stop, rebuild, restart)
- `pnpm docker:stop` - Stop production container
- `pnpm docker:clean` - Stop and remove container
- `pnpm docker:logs` - View production logs

### Development Commands
- `pnpm docker:dev` - Start development mode
- `pnpm docker:dev:logs` - View development logs
- `pnpm docker:dev:down` - Stop development

### Build Commands
- `pnpm docker:build` - Build image (with cache)
- `pnpm docker:build:force` - Build image (no cache)

## 🚨 Troubleshooting

### Container Issues
```bash
# Check container status
docker ps -a | grep role-reactor-bot

# Restart if stopped
docker start role-reactor-bot

# Full restart
pnpm docker:restart:prod
```

### Database Issues
```bash
# Check MongoDB connection
docker logs role-reactor-bot | grep -i mongo

# Restart with fresh connection
pnpm docker:restart:prod
```

### Bot Not Responding
```bash
# Check logs
docker logs role-reactor-bot --tail 50

# Restart bot
pnpm docker:restart:prod

# If still issues, full update
pnpm docker:update
```

## 🔧 Alternative Deployment

### PM2 Deployment
```bash
# Install PM2
npm install -g pm2

# Start the bot
pm2 start src/index.js --name role-reactor-bot

# Monitor
pm2 monit

# View logs
pm2 logs role-reactor-bot
```

### Manual Deployment
```bash
# Install dependencies
pnpm install

# Start the bot
pnpm start
```

## 📈 Performance

### Resource Requirements
- **CPU**: 1 core minimum, 2+ cores recommended
- **Memory**: 512MB minimum, 1GB+ recommended
- **Storage**: 100MB for application, additional for logs
- **Network**: Stable internet connection

### Monitoring Metrics
- **Uptime**: Target 99.9%
- **Response Time**: <100ms for commands
- **Memory Usage**: <200MB baseline
- **Error Rate**: <0.1%

## 🔐 Security

### Environment Variables
- Never commit `.env` files
- Use different tokens for development and production
- Rotate tokens regularly
- Use strong, unique passwords for MongoDB

### Network Security
- Use HTTPS for external connections
- Configure firewall rules appropriately
- Monitor for suspicious activity
- Keep dependencies updated

## 📞 Support

For deployment issues:
1. Check the logs: `docker logs role-reactor-bot`
2. Verify environment variables
3. Test database connectivity
4. Create an issue on GitHub with logs 