require('dotenv').config();
const fastify = require('fastify')({ logger: true });

// ✅ FIX: parser global (ANTES de rutas)
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  if (!body || body.trim() === '') {
    done(null, {});
    return;
  }
  try {
    done(null, JSON.parse(body));
  } catch (e) {
    const err = new Error('JSON inválido');
    err.statusCode = 400;
    done(err);
  }
});

const PORT = 3002;

// ⬇️ después del parser
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