module.exports = {
  apps: [
    {
      name: 'scoreboard-socket',
      script: 'server.cjs',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        SOCKET_PORT: 5152,
      },
      error_file: './logs/scoreboard-socket-error.log',
      out_file: './logs/scoreboard-socket-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
}
