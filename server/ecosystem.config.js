module.exports = {
  apps: [{
    name: 'server',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    kill_timeout: 10000,  // Give 10 seconds for graceful shutdown
    listen_timeout: 10000, // Wait up to 10 seconds for app to be ready
    shutdown_with_message: false
  }]
};