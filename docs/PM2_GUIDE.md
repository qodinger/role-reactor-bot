# PM2 Guide for Role Reactor Bot

This guide explains how to use PM2 to manage your Discord bot in production environments.

## Installation

PM2 is already included as a dev dependency. Install it globally for easier access:

```bash
pnpm add -g pm2
```

## Quick Start

### Development
```bash
# Start the bot in development mode
pnpm run pm2:start

# Or use the direct PM2 command
pm2 start ecosystem.config.js
```

### Production
```bash
# Start the bot in production mode
pnpm run pm2:start:prod

# Or use the direct PM2 command
pm2 start ecosystem.config.js --env production
```

### Staging
```bash
# Start the bot in staging mode
pnpm run pm2:start:staging

# Or use the direct PM2 command
pm2 start ecosystem.config.js --env staging
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm run pm2:start` | Start the bot in development mode |
| `pnpm run pm2:start:prod` | Start the bot in production mode |
| `pnpm run pm2:start:staging` | Start the bot in staging mode |
| `pnpm run pm2:stop` | Stop the bot |
| `pnpm run pm2:restart` | Restart the bot |
| `pnpm run pm2:reload` | Reload the bot (zero-downtime restart) |
| `pnpm run pm2:delete` | Delete the bot from PM2 |
| `pnpm run pm2:logs` | View bot logs |
| `pnpm run pm2:monit` | Open PM2 monitoring dashboard |
| `pnpm run pm2:status` | Check bot status |
| `pnpm run pm2:save` | Save current PM2 process list |
| `pnpm run pm2:resurrect` | Restore saved PM2 process list |

## Direct PM2 Commands

### Basic Management
```bash
# Start the bot
pm2 start ecosystem.config.js

# Stop the bot
pm2 stop role-reactor-bot

# Restart the bot
pm2 restart role-reactor-bot

# Delete the bot from PM2
pm2 delete role-reactor-bot
```

### Monitoring and Logs
```bash
# View real-time logs
pm2 logs role-reactor-bot

# View logs with timestamps
pm2 logs role-reactor-bot --timestamp

# Monitor all processes
pm2 monit

# Check status
pm2 status

# View detailed information
pm2 show role-reactor-bot
```

### Process Management
```bash
# Save current process list
pm2 save

# Restore saved process list
pm2 resurrect

# List all processes
pm2 list

# Kill all processes
pm2 kill
```

## Configuration

The PM2 configuration is in `ecosystem.config.js`. Key settings:

- **instances**: Number of bot instances (set to 1 for Discord bots)
- **autorestart**: Automatically restart on crash
- **max_memory_restart**: Restart if memory usage exceeds 1GB
- **watch**: Disabled for Discord bots (file watching can cause issues)
- **log files**: Logs are saved to `./logs/` directory

## Environment Variables

The configuration supports three environments:

- **development**: Default environment
- **production**: Production environment
- **staging**: Staging environment

Each environment can have different environment variables set in the ecosystem config.

## Logs

Logs are automatically saved to:
- `./logs/err.log` - Error logs
- `./logs/out.log` - Standard output logs
- `./logs/combined.log` - Combined logs

## Best Practices

1. **Always use PM2 in production**: PM2 provides process management, auto-restart, and monitoring.

2. **Use environment-specific configs**: Use production environment for live bots.

3. **Monitor your bot**: Use `pm2 monit` to monitor CPU, memory, and logs.

4. **Save your configuration**: Use `pm2 save` to persist your process list.

5. **Set up startup script**: Use `pm2 startup` to start PM2 on system boot.

6. **Regular log rotation**: PM2 handles log rotation automatically.

## Troubleshooting

### Bot not starting
```bash
# Check logs for errors
pm2 logs role-reactor-bot

# Check if environment variables are set
pm2 show role-reactor-bot
```

### High memory usage
- Check if the bot is leaking memory
- Consider increasing `max_memory_restart` in ecosystem config
- Monitor with `pm2 monit`

### Frequent restarts
- Check error logs for the cause
- Verify environment variables are correct
- Ensure Discord token is valid

## Startup Script (Optional)

To start PM2 on system boot:

```bash
# Generate startup script
pm2 startup

# Follow the instructions provided
# Then save your current process list
pm2 save
```

This will ensure your bot starts automatically when the server reboots. 