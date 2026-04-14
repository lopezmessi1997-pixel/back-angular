const jwt = require('jsonwebtoken');
const R   = require('./response');

const PERMISSIONS_MAP = {
  // ── TICKETS ───────────────────────────────────────────────────────────────
  'GET /tickets/group/:groupId': 'ticket:view',
  'GET /tickets/:id':            'ticket:view',
  'POST /tickets':               'ticket:add',
  'PUT /tickets/:id':            'ticket:edit',
  'PATCH /tickets/:id/status':   'ticket:edit_state',
  'DELETE /tickets/:id':         'ticket:delete',
  'POST /tickets/:id/comments':  'ticket:view',

  // ── GRUPOS — permisos validados internamente en el MS de grupos ───────────
  // (no se registran aquí porque son permisos por grupo, no globales)

  // ── USUARIOS ──────────────────────────────────────────────────────────────
  'GET /users':        'user:view',
  'GET /users/:id':    'user:view',
  'POST /users':       'user:add',
  'PUT /users/:id':    'user:edit',
  'DELETE /users/:id': 'user:delete',
};

const PUBLIC_ROUTES = [
  'POST /auth/login',
  'POST /auth/register',
  'GET /health',
];

function matchPermission(method, path) {
  const key = `${method} ${path}`;
  if (PERMISSIONS_MAP[key]) return PERMISSIONS_MAP[key];

  for (const pattern of Object.keys(PERMISSIONS_MAP)) {
    const [pMethod, pPath] = pattern.split(' ');
    if (pMethod !== method) continue;
    const regex = new RegExp('^' + pPath.replace(/:[^/]+/g, '[^/]+') + '$');
    if (regex.test(path)) return PERMISSIONS_MAP[pattern];
  }

  return null;
}

function isPublic(method, path) {
  return PUBLIC_ROUTES.some(r => {
    const [m, p] = r.split(' ');
    return m === method && path.startsWith(p.replace(/:[^/]+/g, ''));
  });
}

async function authMiddleware(req, reply) {
  const method = req.method;
  const path   = req.url.split('?')[0].replace(/^\/api/, '');

  if (isPublic(method, path)) return;

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send(R.unauth('Token requerido.'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;

    // Inyectar x-user-id para que el proxy lo reenvíe a los microservicios
    req.headers['x-user-id'] = String(payload.userId ?? payload.id ?? '');
  } catch (err) {
    return reply.status(401).send(R.unauth('Token inválido o expirado.'));
  }

  const required = matchPermission(method, path);
  if (required) {
    const userPerms = req.user.perms ?? [];
    if (!userPerms.includes(required)) {
      return reply.status(403).send(R.forbidden(`Permiso requerido: ${required}`));
    }
  }
}

module.exports = authMiddleware;