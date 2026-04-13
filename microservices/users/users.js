const supa = require('./supabase');
const R    = require('./response');

// ── JSON SCHEMAS ──────────────────────────────────────────────────────────────
const addUserSchema = {
  schema: {
    body: {
      type: 'object',
      required: ['username', 'email', 'password', 'name', 'role'],
      properties: {
        username:   { type: 'string', minLength: 3, maxLength: 50 },
        email:      { type: 'string', format: 'email' },
        password:   { type: 'string', minLength: 6 },
        name:       { type: 'string', minLength: 2 },
        role:       { type: 'string', enum: ['Super Admin', 'Admin', 'Usuario'] },
        group_id:   { type: 'integer' },
        status:     { type: 'string', enum: ['active', 'inactive'], default: 'active' },
        perm_codes: { type: 'array', items: { type: 'string' }, default: [] },
      },
      additionalProperties: false,
    },
  },
};

const updateUserSchema = {
  schema: {
    body: {
      type: 'object',
      properties: {
        name:       { type: 'string', minLength: 2 },
        email:      { type: 'string', format: 'email' },
        role:       { type: 'string', enum: ['Super Admin', 'Admin', 'Usuario'] },
        group_id:   { type: 'integer' },
        status:     { type: 'string', enum: ['active', 'inactive'] },
        perm_codes: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
  },
};

async function usersRoutes(fastify) {

  // GET /users — todos los usuarios
  fastify.get('/', async (req, reply) => {
    const { data, error } = await supa
      .from('users')
      .select('id, username, name, email, role, status, group_id')
      .order('id');

    if (error) return reply.status(500).send(R.serverErr(error.message));
    return reply.send(R.ok(data, 'SxUS200'));
  });

  // GET /users/:id — un usuario
  fastify.get('/:id', async (req, reply) => {
    const { data, error } = await supa
      .from('users')
      .select('id, username, name, email, role, status, group_id, user_permissions(permissions(code))')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return reply.status(404).send(R.notFound('Usuario no encontrado.'));

    const perms = data.user_permissions?.map((up) => up.permissions.code) ?? [];
    return reply.send(R.ok({ ...data, perms, user_permissions: undefined }, 'SxUS200'));
  });

  // POST /users — agregar usuario con permisos
  fastify.post('/', addUserSchema, async (req, reply) => {
    const { username, email, password, name, role, group_id, status = 'active', perm_codes = [] } = req.body;

    const { data: existing } = await supa
      .from('users')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`)
      .single();

    if (existing) return reply.status(400).send(R.badReq('El username o email ya existe.'));

    const { data: newUser, error } = await supa
      .from('users')
      .insert({ username, email, password, name, role, group_id, status })
      .select('id, username')
      .single();

    if (error) return reply.status(400).send(R.badReq(error.message));

    if (perm_codes.length) {
      const { data: perms } = await supa.from('permissions').select('id').in('code', perm_codes);
      if (perms?.length)
        await supa.from('user_permissions').insert(perms.map(p => ({ user_id: newUser.id, permission_id: p.id })));
    }

    return reply.status(201).send(R.created({ id: newUser.id, username: newUser.username }, 'SxUS201'));
  });

  // PUT /users/:id — editar usuario
  fastify.put('/:id', updateUserSchema, async (req, reply) => {
    const { perm_codes, ...fields } = req.body;
    const id = req.params.id;

    const { error } = await supa.from('users').update(fields).eq('id', id);
    if (error) return reply.status(500).send(R.serverErr(error.message));

    if (perm_codes !== undefined) {
      await supa.from('user_permissions').delete().eq('user_id', id);
      if (perm_codes.length) {
        const { data: perms } = await supa.from('permissions').select('id').in('code', perm_codes);
        if (perms?.length)
          await supa.from('user_permissions').insert(perms.map(p => ({ user_id: Number(id), permission_id: p.id })));
      }
    }

    return reply.send(R.ok({ message: 'Usuario actualizado.' }, 'SxUS200'));
  });

  // DELETE /users/:id
  fastify.delete('/:id', async (req, reply) => {
    const { error } = await supa.from('users').delete().eq('id', req.params.id);
    if (error) return reply.status(500).send(R.serverErr(error.message));
    return reply.send(R.ok({ message: 'Usuario eliminado.' }, 'SxUS200'));
  });
}

module.exports = usersRoutes;