require('dotenv').config();
const fastify = require('fastify')({ logger: true });
const authRoutes = require('./routes/auth');

// Registrar rutas
fastify.register(authRoutes, { prefix: '/api/auth' });

// Health check
fastify.get('/', async () => ({ status: 'ok', message: 'ERP Fastify API running' }));

// Iniciar servidor
const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();