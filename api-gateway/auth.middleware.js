const jwt = require('jsonwebtoken');
const R   = require('./response');

// Mapa de permisos requeridos por endpoint
// formato: 'METHOD /ruta' => 'permiso_requerido'
const PERMISSIONS_MAP = {
  'GET /tickets/group/:groupId': 'ticket:view',
  'GET /tickets/:id':            'ticket:view',
  'POST /tickets':               'ticket:add',
  'PUT /tickets/:id':            'ticket:edit',
  'PATCH /tickets/:id/status':   'ticket:edit_state',
  'DELETE /tickets/:id':         'ticket:delete',
  'POST /tickets/:id/comments':  'ticket:view',

  'GET /groups':                          'group:view',
  'GET /groups/:id/members':              'group:view',
  'GET /groups/:id/permissions/:userId':  'group:view',
  'POST /groups':                         'group:add',
  'POST /groups/:id/members':             'group:edit',
  'POST /groups/:id/permissions':         'group:edit',
  'PUT /groups/:id':                      'group:edit',
  'DELETE /groups/:id/members/:userId':   'group:edit',
  'DELETE /groups/:id':                   'group:delete',

  'GET /users':     'user:view',
  'GET /users/:id': 'user:view',
  'POST /users':    'user:add',
  'PUT /users/:id': 'user:edit',
  'DELETE /users/:id': 'user:delete',
};

// Rutas que NO requieren token
const PUBLIC_ROUTES = [
  'POST /auth/login',
  'POST /auth/register',
  'GET /health',
];

function matchPermission(method, path) {
  const key = `${method} ${path}`;

  // Coincidencia exacta
  if (PERMISSIONS_MAP[key]) return PERMISSIONS_MAP[key];

  // Coincidencia con patrones :param
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

  // Rutas públicas — no requieren token
  if (isPublic(method, path)) return;

  // Verificar Authorization header
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send(R.unauth('Token requerido.'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
  } catch (err) {
    return reply.status(401).send(R.unauth('Token inválido o expirado.'));
  }

  // Verificar permiso requerido para el endpoint
  const required = matchPermission(method, path);
  if (required) {
    const userPerms = req.user.perms ?? [];
    if (!userPerms.includes(required)) {
      return reply.status(403).send(R.forbidden(`Permiso requerido: ${required}`));
    }
  }
}

module.exports = authMiddleware;