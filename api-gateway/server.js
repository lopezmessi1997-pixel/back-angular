await fastify.register(require('@fastify/cors'), {
  origin: (origin, cb) => {
    const allowed = [
      'http://localhost:4200',
      'https://angular-git-main-alanlm18s-projects.vercel.app',
    ];
    if (!origin || allowed.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});