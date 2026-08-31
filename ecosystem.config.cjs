module.exports = {
  apps: [
    {
      name: 'role-reactor-bot',
      script: 'src/index.js',
      node_args: '--max-old-space-size=256',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3030,
      },
      // Restart on memory limit (set higher than max-old-space-size to avoid restarts during normal operation)
      max_memory_restart: '350M',
      // Logging
      log_file: './logs/pm2-combined.log',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Auto restart
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      // Graceful restart
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Environment specific
      env_development: {
        NODE_ENV: 'development',
        PORT: 3030,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3030,
      },
    },
  ],
};
