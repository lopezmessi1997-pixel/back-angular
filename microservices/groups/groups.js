const supa = require('./supabase');
const R    = require('./response');

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

async function groupsRoutes(fastify) {

  // GET /groups — todos los grupos con conteos
  fastify.get('/', async (req, reply) => {
    const { data, error } = await supa
      .from('groups')
      .select('id, nombre, nivel, descripcion, autor, created_at')
      .order('id');

    if (error) return reply.status(500).send(R.serverErr(error.message));
    return reply.send(R.ok(data, 'SxGR200'));
  });

  // GET /groups/:id/members — miembros del grupo
  fastify.get('/:id/members', async (req, reply) => {
    const { data, error } = await supa
      .from('group_members')
      .select('role, users(id, name, email, role)')
      .eq('group_id', req.params.id);

    if (error) return reply.status(500).send(R.serverErr(error.message));
    return reply.send(R.ok(data, 'SxGR200'));
  });



  // GET /api/groups/my — grupos del usuario logueado
fastify.get('/my', async (req, reply) => {
  const userId = req.user?.userId;
  if (!userId) return reply.status(401).send(R.unauth('Usuario no autenticado.'));

  const { data, error } = await supa
    .from('group_members')
    .select('role, groups(id, nombre, nivel, descripcion, autor, created_at)')
    .eq('user_id', userId);

  if (error) return reply.status(500).send(R.serverErr(error.message));

  const groups = data?.map(m => ({ ...m.groups, my_role: m.role })) ?? [];
  return reply.send(R.ok(groups));
});

  // GET /groups/:id/permissions/:userId — permisos de un usuario en el grupo
  fastify.get('/:id/permissions/:userId', async (req, reply) => {
    const { data, error } = await supa
      .from('user_permissions')
      .select('permissions(code)')
      .eq('user_id', req.params.userId);

    if (error) return reply.status(500).send(R.serverErr(error.message));
    const perms = data?.map(up => up.permissions.code) ?? [];
    return reply.send(R.ok({ user_id: req.params.userId, group_id: req.params.id, perms }, 'SxGR200'));
  });

  // POST /groups — crear grupo
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
    const { user_id, role = 'Visor' } = req.body;

    const { error } = await supa
      .from('group_members')
      .insert({ group_id: Number(req.params.id), user_id, role });

    if (error) return reply.status(400).send(R.badReq(error.message));
    return reply.status(201).send(R.created({ message: 'Miembro añadido.' }, 'SxGR201'));
  });

  // POST /groups/:id/permissions — asignar permisos a usuario en grupo
  fastify.post('/:id/permissions', permSchema, async (req, reply) => {
    const { user_id, perm_codes } = req.body;

    // Reemplazar permisos
    await supa.from('user_permissions').delete().eq('user_id', user_id);

    if (perm_codes.length) {
      const { data: perms } = await supa.from('permissions').select('id').in('code', perm_codes);
      if (perms?.length)
        await supa.from('user_permissions').insert(perms.map(p => ({ user_id, permission_id: p.id })));
    }

    return reply.send(R.ok({ message: 'Permisos actualizados.' }, 'SxGR200'));
  });

  // PUT /groups/:id — editar grupo
  fastify.put('/:id', updateSchema, async (req, reply) => {
    const { error } = await supa.from('groups').update(req.body).eq('id', req.params.id);
    if (error) return reply.status(500).send(R.serverErr(error.message));
    return reply.send(R.ok({ message: 'Grupo actualizado.' }, 'SxGR200'));
  });

  // DELETE /groups/:id/members/:userId — quitar miembro
  fastify.delete('/:id/members/:userId', async (req, reply) => {
    const { error } = await supa.from('group_members')
      .delete()
      .eq('group_id', req.params.id)
      .eq('user_id', req.params.userId);

    if (error) return reply.status(500).send(R.serverErr(error.message));
    return reply.send(R.ok({ message: 'Miembro eliminado.' }, 'SxGR200'));
  });

  // DELETE /groups/:id — eliminar grupo
  fastify.delete('/:id', async (req, reply) => {
    const { error } = await supa.from('groups').delete().eq('id', req.params.id);
    if (error) return reply.status(500).send(R.serverErr(error.message));
    return reply.send(R.ok({ message: 'Grupo eliminado.' }, 'SxGR200'));
  });
}

module.exports = groupsRoutes;
