const bcrypt   = require('bcryptjs');
const supabase = require('../supabase');

// ── JSON SCHEMAS ──────────────────────────────────────────────────────────────

const loginSchema = {
  schema: {
    description: 'Iniciar sesión con username y password',
    tags: ['auth'],
    body: {
      type: 'object',
      required: ['username', 'password'],
      properties: {
        username: { type: 'string', minLength: 3, maxLength: 50 },
        password: { type: 'string', minLength: 6 },
      },
      additionalProperties: false,
    },
    response: {
      200: {
        type: 'object',
        properties: {
          id:       { type: 'integer' },
          username: { type: 'string' },
          name:     { type: 'string' },
          email:    { type: 'string' },
          role:     { type: 'string' },
          status:   { type: 'string' },
          perms:    { type: 'array', items: { type: 'string' } },
        },
      },
      401: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
    },
  },
};

const registerSchema = {
  schema: {
    description: 'Registrar un nuevo usuario',
    tags: ['auth'],
    body: {
      type: 'object',
      required: ['username', 'password', 'name', 'email'],
      properties: {
        username:  { type: 'string', minLength: 3, maxLength: 50 },
        password:  { type: 'string', minLength: 6 },
        name:      { type: 'string', minLength: 2, maxLength: 100 },
        email:     { type: 'string', format: 'email' },
        role:      { type: 'string', enum: ['Super Admin', 'Admin', 'Usuario'], default: 'Usuario' },
        group_id:  { type: 'integer' },
        birthDate: { type: 'string' },
        phone:     { type: 'string' },
        address:   { type: 'string' },
      },
      additionalProperties: false,
    },
    response: {
      201: {
        type: 'object',
        properties: {
          message:  { type: 'string' },
          id:       { type: 'integer' },
          username: { type: 'string' },
        },
      },
      400: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
    },
  },
};

const addUserSchema = {
  schema: {
    description: 'Agregar usuario con permisos (solo admin)',
    tags: ['auth'],
    body: {
      type: 'object',
      required: ['username', 'password', 'name', 'email', 'role'],
      properties: {
        username:   { type: 'string', minLength: 3, maxLength: 50 },
        password:   { type: 'string', minLength: 6 },
        name:       { type: 'string', minLength: 2, maxLength: 100 },
        email:      { type: 'string', format: 'email' },
        role:       { type: 'string', enum: ['Super Admin', 'Admin', 'Usuario'] },
        group_id:   { type: 'integer' },
        status:     { type: 'string', enum: ['active', 'inactive'], default: 'active' },
        perm_codes: {
          type: 'array',
          items: { type: 'string' },
          default: [],
        },
      },
      additionalProperties: false,
    },
    response: {
      201: {
        type: 'object',
        properties: {
          message:  { type: 'string' },
          id:       { type: 'integer' },
          username: { type: 'string' },
        },
      },
      400: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
    },
  },
};

// ── RUTAS ─────────────────────────────────────────────────────────────────────

async function authRoutes(fastify) {

  // POST /api/auth/login
  fastify.post('/login', loginSchema, async (req, reply) => {
    const { username, password } = req.body;

    // Buscar usuario
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password, name, email, role, status')
      .eq('username', username)
      .eq('status', 'active')
      .single();

    if (error || !user) {
      return reply.status(401).send({ error: 'Usuario no encontrado o inactivo.' });
    }

    // Verificar contraseña
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return reply.status(401).send({ error: 'Contraseña incorrecta.' });
    }

    // Obtener permisos del usuario
    const { data: userPerms } = await supabase
      .from('user_permissions')
      .select('permissions(code)')
      .eq('user_id', user.id);

    const perms = userPerms?.map(up => up.permissions.code) ?? [];

    return reply.send({
      id:       user.id,
      username: user.username,
      name:     user.name,
      email:    user.email,
      role:     user.role,
      status:   user.status,
      perms,
    });
  });


  // POST /api/auth/register
  fastify.post('/register', registerSchema, async (req, reply) => {
    const { username, password, name, email, role = 'Usuario', group_id, birthDate, phone, address } = req.body;

    // Verificar si username o email ya existen
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`)
      .single();

    if (existing) {
      return reply.status(400).send({ error: 'El username o email ya está registrado.' });
    }

    // Hashear contraseña
    const password_hash = await bcrypt.hash(password, 10);

    // Insertar usuario
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ username, password: password_hash, name, email, role, group_id, status: 'active' })
      .select('id, username')
      .single();

    if (error) {
      return reply.status(400).send({ error: error.message });
    }

    // Permisos por defecto según rol
    const defaultPerms = {
      'Super Admin': ['group:view','group:edit','group:add','group:delete','ticket:view','ticket:edit','ticket:add','ticket:delete','ticket:edit_state','user:view','users:view','user:edit','user:add','user:delete','superadmin'],
      'Admin':       ['group:view','group:edit','group:add','group:delete','ticket:view','ticket:edit','ticket:add','ticket:delete','ticket:edit_state','user:view','users:view'],
      'Usuario':     ['group:view','ticket:view','ticket:edit_state','user:view'],
    };

    const permCodes = defaultPerms[role] ?? defaultPerms['Usuario'];
    const { data: perms } = await supabase
      .from('permissions')
      .select('id')
      .in('code', permCodes);

    if (perms?.length) {
      await supabase.from('user_permissions')
        .insert(perms.map(p => ({ user_id: newUser.id, permission_id: p.id })));
    }

    return reply.status(201).send({
      message:  'Usuario registrado exitosamente.',
      id:       newUser.id,
      username: newUser.username,
    });
  });


  // POST /api/auth/add-user
  fastify.post('/add-user', addUserSchema, async (req, reply) => {
    const { username, password, name, email, role, group_id, status = 'active', perm_codes = [] } = req.body;

    // Verificar duplicados
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`)
      .single();

    if (existing) {
      return reply.status(400).send({ error: 'El username o email ya está registrado.' });
    }

    // Hashear contraseña
    const password_hash = await bcrypt.hash(password, 10);

    // Insertar usuario
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ username, password: password_hash, name, email, role, group_id, status })
      .select('id, username')
      .single();

    if (error) {
      return reply.status(400).send({ error: error.message });
    }

    // Asignar permisos específicos
    if (perm_codes.length) {
      const { data: perms } = await supabase
        .from('permissions')
        .select('id')
        .in('code', perm_codes);

      if (perms?.length) {
        await supabase.from('user_permissions')
          .insert(perms.map(p => ({ user_id: newUser.id, permission_id: p.id })));
      }
    }

    return reply.status(201).send({
      message:  'Usuario agregado exitosamente.',
      id:       newUser.id,
      username: newUser.username,
    });
  });

}

module.exports = authRoutes;