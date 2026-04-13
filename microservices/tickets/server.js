require('dotenv').config();
const fastify = require('fastify')({ logger: true });

const PORT = 3002;

fastify.register(require('./tickets'), { prefix: '/tickets' });

fastify.get('/health', async () => ({
  status: 'ok',
  service: 'ms-tickets',
  port: PORT
}));

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) { 
    fastify.log.error(err); 
    process.exit(1); 
  }
});