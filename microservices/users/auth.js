const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const supa    = require('./supabase');
const R       = require('./response');

// ── JSON SCHEMAS ──────────────────────────────────────────────────────────────
const loginSchema = {
  schema: {
    body: {
      type: 'object',
      required: ['username', 'password'],
      properties: {
        username: { type: 'string', minLength: 3 },
        password: { type: 'string', minLength: 6 },
      },
      additionalProperties: false,
    },
  },
};

const registerSchema = {
  schema: {
    body: {
      type: 'object',
      required: ['username', 'email', 'password', 'name'],
      properties: {
        username:  { type: 'string', minLength: 3, maxLength: 50 },
        email:     { type: 'string', format: 'email' },
        password:  { type: 'string', minLength: 6 },
        name:      { type: 'string', minLength: 2 },
        birthDate: { type: 'string' },
        phone:     { type: 'string' },
        address:   { type: 'string' },
      },
      additionalProperties: false,
    },
  },
};

async function authRoutes(fastify) {

  // POST /auth/login
  fastify.post('/login', loginSchema, async (req, reply) => {
    const { username, password } = req.body;

    const { data: user, error } = await supa
      .from('users')
      .select('id, username, password, name, email, role, status')
      .or(`username.eq.${username},email.eq.${username}`)
      .eq('status', 'active')
      .single();

    if (error || !user)
      return reply.status(401).send(R.unauth('Usuario no encontrado o inactivo.'));

    const valid = password === user.password; // TODO: bcrypt.compare cuando haya hash
    if (!valid)
      return reply.status(401).send(R.unauth('Contraseña incorrecta.'));

    // Obtener permisos del usuario
    const { data: userPerms } = await supa
      .from('user_permissions')
      .select('permissions(code)')
      .eq('user_id', user.id);

    const perms = userPerms?.map(up => up.permissions.code) ?? [];

    // Generar JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username, name: user.name, role: user.role, perms },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return reply.send(R.ok({
      token,
      user: { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role },
      perms,
    }, 'SxUS200'));
  });


  // POST /auth/register
  fastify.post('/register', registerSchema, async (req, reply) => {
    const { username, email, password, name, birthDate, phone, address } = req.body;

    // Verificar duplicados
    const { data: existing } = await supa
      .from('users')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`)
      .single();

    if (existing)
      return reply.status(400).send(R.badReq('El username o email ya está registrado.'));

    const { data: newUser, error } = await supa
      .from('users')
      .insert({ username, email, password, name, role: 'Usuario', status: 'active' })
      .select('id, username')
      .single();

    if (error)
      return reply.status(400).send(R.badReq(error.message));

    // Permisos por defecto para Usuario
    const { data: perms } = await supa
      .from('permissions')
      .select('id')
      .in('code', ['group:view', 'ticket:view', 'ticket:edit_state', 'user:view']);

    if (perms?.length) {
      await supa.from('user_permissions')
        .insert(perms.map(p => ({ user_id: newUser.id, permission_id: p.id })));
    }

    return reply.status(201).send(R.created({ id: newUser.id, username: newUser.username }, 'SxUS201'));
  });
}

module.exports = authRoutes;