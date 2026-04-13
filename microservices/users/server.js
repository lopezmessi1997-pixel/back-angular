require('dotenv').config();
const fastify = require('fastify')({ logger: true });

fastify.register(require('./auth'),  { prefix: '/auth' });
fastify.register(require('./users'), { prefix: '/users' });

const PORT = 3001;

fastify.get('/health', async () => ({
  status: 'ok',
  service: 'ms-users',
  port: PORT
}));

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) { fastify.log.error(err); process.exit(1); }
});