require('dotenv').config();
const fastify = require('fastify')({ logger: true });

// ── Fix: permite DELETE sin body ──────────────────────────────────────────
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  if (!body || body.length === 0) {
    done(null, {});
    return;
  }
  try {
    done(null, JSON.parse(body));
  } catch (err) {
    err.statusCode = 400;
    done(err, undefined);
  }
});

fastify.register(require('./groups'), { prefix: '/groups' });

const PORT = process.env.PORT_GROUPS || 3003;

fastify.get('/health', async () => ({
  status: 'ok',
  service: 'ms-groups',
  port: PORT
}));

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) { fastify.log.error(err); process.exit(1); }
});