module.exports = {
  apps: [
    {
      name: 'ecm-api',
      script: 'server.js',
      cwd: '/home/ubuntu/ecm-ai-os/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/home/ubuntu/ecm-ai-os/backend/logs/error.log',
      out_file: '/home/ubuntu/ecm-ai-os/backend/logs/out.log',
      merge_logs: true
    }
  ]
};
