require('dotenv').config();
const fastify = require('fastify')({ logger: true });

fastify.register(require('./auth'),  { prefix: '/auth' });
fastify.register(require('./users'), { prefix: '/users' });

fastify.get('/health', async () => ({ status: 'ok', service: 'ms-users' }));

// ✅ Exportar la promesa
module.exports = fastify.listen({ port: 3001, host: '0.0.0.0' });