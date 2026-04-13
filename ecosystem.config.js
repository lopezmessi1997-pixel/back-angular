module.exports = {
  apps: [
    {
      name: 'api-gateway',
      script: './api-gateway/Server.js',
      env: { PORT: process.env.PORT || 3000 }  // Railway usa PORT
    },
    {
      name: 'groups',
      script: './microservices/groups/Server.js',
      env: { PORT: 3001 }
    },
    {
      name: 'tickets',
      script: './microservices/tickets/Server.js',
      env: { PORT: 3002 }
    },
    {
      name: 'users',
      script: './microservices/users/Server.js',
      env: { PORT: 3003 }
    }
  ]
};