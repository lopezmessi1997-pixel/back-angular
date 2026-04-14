const supa = require('./supabase');
const R    = require('./response');

// ── Schemas ───────────────────────────────────────────────────────────────────

const createSchema = {
  schema: {
    body: {
      type: 'object',
      required: ['nombre', 'nivel', 'autor'],
      properties: {
        nombre:      { type: 'string', minLength: 2, maxLength: 100 },
        nivel:       { type: 'string', enum: ['Alto','Medio','Bajo'] },
        descripcion: { type: 'string' },
        autor:       { type: 'string' },
      },
      additionalProperties: false,
    },
  },
};

const updateSchema = {
  schema: {
    body: {
      type: 'object',
      properties: {
        nombre:      { type: 'string', minLength: 2 },
        nivel:       { type: 'string', enum: ['Alto','Medio','Bajo'] },
        descripcion: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
};

const memberSchema = {
  schema: {
    body: {
      type: 'object',
      required: ['user_id'],
      properties: {
        user_id: { type: 'integer' },
        role:    { type: 'string', enum: ['Admin','Editor','Visor'], default: 'Visor' },
      },
      additionalProperties: false,
    },
  },
};

const permSchema = {
  schema: {
    body: {
      type: 'object',
      required: ['user_id', 'perm_codes'],
      properties: {
        user_id:    { type: 'integer' },
        perm_codes: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
  },
};

// ── Helper: obtener permisos de un usuario en un grupo específico ─────────────

async function getUserGroupPerms(userId, groupId) {
  const { data, error } = await supa
    .from('user_permissions')
    .select('permissions(code)')
    .eq('user_id', userId)
    .eq('group_id', groupId);

  if (error) return [];
  return (data ?? []).map(row => row.permissions?.code).filter(Boolean);
}

// ── Helper: verificar si el usuario es superadmin (perms globales en header) ──

function isSuperAdmin(req) {
  try {
    const perms = JSON.parse(req.headers['x-user-perms'] ?? '[]');
    return perms.includes('superadmin');
  } catch {
    return false;
  }
}

// ── Rutas ─────────────────────────────────────────────────────────────────────

async function groupsRoutes(fastify) {

  // GET /groups — listar todos
  fastify.get('/', async (req, reply) => {
    const { data, error } = await supa
      .from('groups')
      .select('id, nombre, nivel, descripcion, autor, created_at')
      .order('id');
    if (error) return reply.status(500).send(R.serverErr(error.message));
    return reply.send(R.ok(data, 'SxGR200'));
  });

  // GET /groups/my — grupos del usuario autenticado
  fastify.get('/my', async (req, reply) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return reply.status(401).send(R.unauth('Usuario no autenticado.'));

    const { data, error } = await supa
      .from('group_members')
      .select('role, groups(id, nombre, nivel, descripcion, autor, created_at)')
      .eq('user_id', userId);
    if (error) return reply.status(500).send(R.serverErr(error.message));

    const groups = data?.map(row => ({ ...row.groups, my_role: row.role })) ?? [];
    return reply.send(R.ok(groups, 'SxGR200'));
  });

  // GET /groups/user/:userId — grupos de un usuario específico
  fastify.get('/user/:userId', async (req, reply) => {
    const { data, error } = await supa
      .from('group_members')
      .select('role, groups(id, nombre, nivel, descripcion, autor, created_at)')
      .eq('user_id', req.params.userId);
    if (error) return reply.status(500).send(R.serverErr(error.message));

    const groups = data?.map(row => ({ ...row.groups, my_role: row.role })) ?? [];
    return reply.send(R.ok(groups, 'SxGR200'));
  });

  // GET /groups/:id/members
  fastify.get('/:id/members', async (req, reply) => {
    const { data, error } = await supa
      .from('group_members')
      .select('role, users(id, name, email, role)')
      .eq('group_id', req.params.id);
    if (error) return reply.status(500).send(R.serverErr(error.message));
    return reply.send(R.ok(data, 'SxGR200'));
  });

  // GET /groups/:id/permissions/:userId
  fastify.get('/:id/permissions/:userId', async (req, reply) => {
    const group_id = Number(req.params.id);
    const user_id  = Number(req.params.userId);

    const { data, error } = await supa
      .from('user_permissions')
      .select('permissions(code, description)')
      .eq('user_id', user_id)
      .eq('group_id', group_id);

    if (error) return reply.status(500).send(R.serverErr(error.message));

    const perms = data?.map(up => ({
      code:        up.permissions.code,
      description: up.permissions.description,
    })) ?? [];

    return reply.send(R.ok({ user_id, group_id, perms }, 'SxGR200'));
  });

  // POST /groups — crear grupo (requiere group:add en perms globales)
  fastify.post('/', createSchema, async (req, reply) => {
    const { data, error } = await supa
      .from('groups')
      .insert(req.body)
      .select('id, nombre')
      .single();
    if (error) return reply.status(400).send(R.badReq(error.message));
    return reply.status(201).send(R.created(data, 'SxGR201'));
  });

  // POST /groups/:id/members — añadir miembro
  fastify.post('/:id/members', memberSchema, async (req, reply) => {
    const userId  = Number(req.headers['x-user-id']);
    const groupId = Number(req.params.id);

    if (!userId) return reply.status(401).send(R.unauth('No autenticado.'));

    // Debe tener group:edit en ese grupo O ser superadmin
    const perms = await getUserGroupPerms(userId, groupId);
    if (!perms.includes('group:edit') && !isSuperAdmin(req)) {
      return reply.status(403).send(R.forbidden('Permiso requerido: group:edit'));
    }

    const { user_id, role = 'Visor' } = req.body;
    const { error } = await supa
      .from('group_members')
      .insert({ group_id: groupId, user_id, role });
    if (error) return reply.status(400).send(R.badReq(error.message));
    return reply.status(201).send(R.created({ message: 'Miembro añadido.' }, 'SxGR201'));
  });

  // POST /groups/:id/permissions — asignar permisos a usuario en ese grupo
  fastify.post('/:id/permissions', permSchema, async (req, reply) => {
    const userId  = Number(req.headers['x-user-id']);
    const groupId = Number(req.params.id);

    if (!userId) return reply.status(401).send(R.unauth('No autenticado.'));

    const perms = await getUserGroupPerms(userId, groupId);
    if (!perms.includes('group:edit') && !isSuperAdmin(req)) {
      return reply.status(403).send(R.forbidden('Permiso requerido: group:edit'));
    }

    const { user_id, perm_codes } = req.body;

    // Obtener todos los permisos disponibles
    const { data: allPerms, error: permError } = await supa
      .from('permissions')
      .select('id, code');
    if (permError) return reply.status(500).send(R.serverErr('Error al buscar permisos: ' + permError.message));

    const permIds = allPerms ?? [];

    // Borrar permisos actuales del usuario en ese grupo
    await supa
      .from('user_permissions')
      .delete()
      .eq('user_id', user_id)
      .eq('group_id', groupId);

    // Limpiar registros huérfanos con group_id NULL
    await supa
      .from('user_permissions')
      .delete()
      .eq('user_id', user_id)
      .is('group_id', null);

    // Insertar nuevos permisos
    if (perm_codes.length > 0) {
      const matchedPerms = permIds.filter(p => perm_codes.includes(p.code));
      if (matchedPerms.length > 0) {
        const rows = matchedPerms.map(p => ({
          user_id,
          permission_id: p.id,
          group_id:      groupId,
        }));
        const { error: insertError } = await supa
          .from('user_permissions')
          .insert(rows);
        if (insertError) return reply.status(500).send(R.serverErr('Error al insertar permisos: ' + insertError.message));
      }
    }

    return reply.send(R.ok({
      message: 'Permisos actualizados.',
      group_id: groupId,
      user_id,
      total: perm_codes.length,
    }, 'SxGR200'));
  });

  // PUT /groups/:id — editar grupo
  fastify.put('/:id', updateSchema, async (req, reply) => {
    const userId  = Number(req.headers['x-user-id']);
    const groupId = Number(req.params.id);

    if (!userId) return reply.status(401).send(R.unauth('No autenticado.'));

    const perms = await getUserGroupPerms(userId, groupId);
    if (!perms.includes('group:edit') && !isSuperAdmin(req)) {
      return reply.status(403).send(R.forbidden('Permiso requerido: group:edit'));
    }

    const { error } = await supa
      .from('groups')
      .update(req.body)
      .eq('id', groupId);
    if (error) return reply.status(500).send(R.serverErr(error.message));
    return reply.send(R.ok({ message: 'Grupo actualizado.' }, 'SxGR200'));
  });

  // DELETE /groups/:id/members/:userId — remover miembro
  fastify.delete('/:id/members/:userId', async (req, reply) => {
    const userId  = Number(req.headers['x-user-id']);
    const groupId = Number(req.params.id);

    if (!userId) return reply.status(401).send(R.unauth('No autenticado.'));

    const perms = await getUserGroupPerms(userId, groupId);
    if (!perms.includes('group:edit') && !isSuperAdmin(req)) {
      return reply.status(403).send(R.forbidden('Permiso requerido: group:edit'));
    }

    const { error } = await supa
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', req.params.userId);
    if (error) return reply.status(500).send(R.serverErr(error.message));
    return reply.send(R.ok({ message: 'Miembro eliminado.' }, 'SxGR200'));
  });

  // DELETE /groups/:id — eliminar grupo
  fastify.delete('/:id', async (req, reply) => {
    const userId  = Number(req.headers['x-user-id']);
    const groupId = Number(req.params.id);

    if (!userId) return reply.status(401).send(R.unauth('No autenticado.'));

    const perms = await getUserGroupPerms(userId, groupId);
    if (!perms.includes('group:delete') && !isSuperAdmin(req)) {
      return reply.status(403).send(R.forbidden('Permiso requerido: group:delete'));
    }

    const { error } = await supa
      .from('groups')
      .delete()
      .eq('id', groupId);
    if (error) return reply.status(500).send(R.serverErr(error.message));
    return reply.send(R.ok({ message: 'Grupo eliminado.' }, 'SxGR200'));
  });
}

module.exports = groupsRoutes;