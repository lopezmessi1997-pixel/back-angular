require('dotenv').config();
const fastify        = require('fastify')({ logger: true });
const authMiddleware = require('./auth.middleware');
const proxy          = require('./proxy');
const R              = require('./response');
const { onRequestHook, onResponseHook, onErrorHook } = require('./logger');

const MS_USERS   = process.env.MS_USERS_URL   || 'http://127.0.0.1:3001';
const MS_TICKETS = process.env.MS_TICKETS_URL || 'http://127.0.0.1:3002';
const MS_GROUPS  = process.env.MS_GROUPS_URL  || 'http://127.0.0.1:3003';

async function start() {
  // ── CORS ───────────────────────────────────────────────────────────────────
  await fastify.register(require('@fastify/cors'), {
    origin: (origin, cb) => {
      const allowed = [
        'http://localhost:4200',
        'https://angular-coral-nu.vercel.app/',
      ];
      if (!origin || allowed.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ── RATE LIMITING ──────────────────────────────────────────────────────────
  await fastify.register(require('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: () => R.tooMany('Too many requests. Intenta en un momento.'),
  });

  // ── LOGGING ───────────────────────────────────────────────────────────────
  fastify.addHook('onRequest',  onRequestHook);
  fastify.addHook('onResponse', onResponseHook);
  fastify.addHook('onError',    onErrorHook);

  // ── MIDDLEWARE JWT ─────────────────────────────────────────────────────────
  fastify.addHook('onRequest', authMiddleware);

  // ── HEALTH ─────────────────────────────────────────────────────────────────
  fastify.get('/health', async () => ({
    status: 'ok', service: 'api-gateway', port: process.env.PORT,
  }));

  // ── LOGS & MÉTRICAS (solo superadmin) ─────────────────────────────────────
  fastify.get('/api/logs', async (req, reply) => {
    if (!req.user?.perms?.includes('superadmin'))
      return reply.status(403).send(R.forbidden('Solo superadmin puede ver los logs.'));
    const { createClient } = require('@supabase/supabase-js');
    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const limit = Number(req.query.limit ?? 50);
    const { data } = await supa
      .from('request_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return reply.send(R.ok(data ?? []));
  });

  fastify.get('/api/metrics', async (req, reply) => {
    if (!req.user?.perms?.includes('superadmin'))
      return reply.status(403).send(R.forbidden('Solo superadmin puede ver las métricas.'));
    const { createClient } = require('@supabase/supabase-js');
    const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { data } = await supa
      .from('endpoint_metrics')
      .select('*')
      .order('total_requests', { ascending: false });
    return reply.send(R.ok(data ?? []));
  });

  // ── AUTH ───────────────────────────────────────────────────────────────────
  fastify.post('/api/auth/login',    async (req, reply) => proxy(req, reply, MS_USERS));
  fastify.post('/api/auth/register', async (req, reply) => proxy(req, reply, MS_USERS));

  // ── USERS ──────────────────────────────────────────────────────────────────
  fastify.get('/api/users',        async (req, reply) => proxy(req, reply, MS_USERS));
  fastify.get('/api/users/:id',    async (req, reply) => proxy(req, reply, MS_USERS));
  fastify.post('/api/users',       async (req, reply) => proxy(req, reply, MS_USERS));
  fastify.put('/api/users/:id',    async (req, reply) => proxy(req, reply, MS_USERS));
  fastify.delete('/api/users/:id', async (req, reply) => proxy(req, reply, MS_USERS));

  // ── TICKETS ────────────────────────────────────────────────────────────────
  fastify.get('/api/tickets/group/:groupId',  async (req, reply) => proxy(req, reply, MS_TICKETS));
  fastify.get('/api/tickets/:id',             async (req, reply) => proxy(req, reply, MS_TICKETS));
  fastify.post('/api/tickets',                async (req, reply) => proxy(req, reply, MS_TICKETS));
  fastify.put('/api/tickets/:id',             async (req, reply) => proxy(req, reply, MS_TICKETS));
  fastify.patch('/api/tickets/:id/status',    async (req, reply) => proxy(req, reply, MS_TICKETS));
  fastify.post('/api/tickets/:id/comments',   async (req, reply) => proxy(req, reply, MS_TICKETS));
  fastify.delete('/api/tickets/:id',          async (req, reply) => proxy(req, reply, MS_TICKETS));

  // ── GROUPS ─────────────────────────────────────────────────────────────────
  fastify.get('/api/groups',                           async (req, reply) => proxy(req, reply, MS_GROUPS));
  fastify.get('/api/groups/:id/members',               async (req, reply) => proxy(req, reply, MS_GROUPS));
  fastify.get('/api/groups/:id/permissions/:userId',   async (req, reply) => proxy(req, reply, MS_GROUPS));
  fastify.post('/api/groups',                          async (req, reply) => proxy(req, reply, MS_GROUPS));
  fastify.post('/api/groups/:id/members',              async (req, reply) => proxy(req, reply, MS_GROUPS));
  fastify.post('/api/groups/:id/permissions',          async (req, reply) => proxy(req, reply, MS_GROUPS));
  fastify.put('/api/groups/:id',                       async (req, reply) => proxy(req, reply, MS_GROUPS));
  fastify.delete('/api/groups/:id/members/:userId',    async (req, reply) => proxy(req, reply, MS_GROUPS));
  fastify.delete('/api/groups/:id',                    async (req, reply) => proxy(req, reply, MS_GROUPS));

  // ── INICIAR ────────────────────────────────────────────────────────────────
  try {
    await fastify.listen({
      port: Number(process.env.PORT) || 8080,
      host: '0.0.0.0',
    });
    console.log(`API Gateway corriendo en http://localhost:${process.env.PORT || 8080}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();