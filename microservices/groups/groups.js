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

  // GET /groups — todos los grupos
  fastify.get('/', async (req, reply) => {
    const { data, error } = await supa
      .from('groups')
      .select('id, nombre, nivel, descripcion, autor, created_at')
      .order('id');

    if (error) return reply.status(500).send(R.serverErr(error.message));
    return reply.send(R.ok(data, 'SxGR200'));
  });

  // GET /groups/my — grupos del usuario logueado (ANTES de /:id)
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

  // GET /groups/user/:userId — grupos de un usuario específico (admin/superadmin)
  fastify.get('/user/:userId', async (req, reply) => {
    const { data, error } = await supa
      .from('group_members')
      .select('role, groups(id, nombre, nivel, descripcion, autor, created_at)')
      .eq('user_id', req.params.userId);

    if (error) return reply.status(500).send(R.serverErr(error.message));

    const groups = data?.map(row => ({ ...row.groups, my_role: row.role })) ?? [];
    return reply.send(R.ok(groups, 'SxGR200'));
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

  // GET /groups/:id/permissions/:userId — permisos de un usuario en ese grupo
  fastify.get('/:id/permissions/:userId', async (req, reply) => {
    // FIX: convertir a número para evitar comparaciones string vs integer en Postgres
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

  // POST /groups/:id/permissions — asignar permisos a usuario en ese grupo
  fastify.post('/:id/permissions', permSchema, async (req, reply) => {
    const { user_id, perm_codes } = req.body;

    // FIX: convertir explícitamente a número — req.params.id siempre llega como string
    // Supabase puede guardar NULL si recibe un string donde espera integer
    const group_id = Number(req.params.id);

    // Eliminar permisos anteriores de ESE usuario en ESE grupo
    const { error: deleteError } = await supa
      .from('user_permissions')
      .delete()
      .eq('user_id', user_id)
      .eq('group_id', group_id);

    if (deleteError) return reply.status(500).send(R.serverErr(deleteError.message));

    // Insertar nuevos permisos si hay códigos
    if (perm_codes.length > 0) {
      const { data: perms, error: permError } = await supa
        .from('permissions')
        .select('id, code')
        .in('code', perm_codes);

      if (permError) return reply.status(500).send(R.serverErr(permError.message));

      if (perms?.length) {
        // FIX: group_id es Number, user_id viene del body ya como integer (validado por schema)
        const rows = perms.map(p => ({
          user_id:       user_id,
          permission_id: p.id,
          group_id:      group_id,   // ← number explícito, no string
        }));

        const { error: insertError } = await supa
          .from('user_permissions')
          .insert(rows);

        if (insertError) return reply.status(500).send(R.serverErr(insertError.message));
      }
    }

    return reply.send(R.ok({ message: 'Permisos actualizados.', group_id, user_id, total: perm_codes.length }, 'SxGR200'));
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