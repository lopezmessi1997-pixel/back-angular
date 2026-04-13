const supa = require('./supabase');
const R    = require('./response');

const createSchema = {
  schema: {
    body: {
      type: 'object',
      required: ['title', 'group_id', 'created_by'],
      properties: {
        title:       { type: 'string', minLength: 3, maxLength: 200 },
        description: { type: 'string' },
        status:      { type: 'string', enum: ['Pendiente','En progreso','Revisión','Hecho','Bloqueado'], default: 'Pendiente' },
        priority:    { type: 'string', enum: ['Crítica','Alta','Media-Alta','Media','Media-Baja','Baja','Mínima'], default: 'Media' },
        group_id:    { type: 'integer' },
        created_by:  { type: 'integer' },
        assigned_to: { type: 'integer' },
        due_date:    { type: 'string' },
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
        title:       { type: 'string', minLength: 3 },
        description: { type: 'string' },
        priority:    { type: 'string', enum: ['Crítica','Alta','Media-Alta','Media','Media-Baja','Baja','Mínima'] },
        assigned_to: { type: 'integer' },
        due_date:    { type: 'string' },
      },
      additionalProperties: false,
    },
  },
};

const statusSchema = {
  schema: {
    body: {
      type: 'object',
      required: ['to_status', 'user_id'],
      properties: {
        from_status: { type: 'string' },
        to_status:   { type: 'string', enum: ['Pendiente','En progreso','Revisión','Hecho','Bloqueado'] },
        user_id:     { type: 'integer' },
      },
      additionalProperties: false,
    },
  },
};

const commentSchema = {
  schema: {
    body: {
      type: 'object',
      required: ['user_id', 'text'],
      properties: {
        user_id: { type: 'integer' },
        text:    { type: 'string', minLength: 1 },
      },
      additionalProperties: false,
    },
  },
};

async function ticketsRoutes(fastify) {

  // GET /tickets/group/:groupId — tickets de un grupo
  fastify.get('/group/:groupId', async (req, reply) => {
  const { data, error } = await supa
    .from('tickets')
    .select(`
      id, title, description, status, priority, due_date, created_at, group_id,
      created_by:users!tickets_created_by_fkey(id, name),
      assigned_to:users!tickets_assigned_to_fkey(id, name)
    `)
    .eq('group_id', req.params.groupId)
    .order('created_at', { ascending: false });

  if (error) return reply.status(500).send(R.serverErr(error.message));
  return reply.send(R.ok(data, 'SxTK200'));
});

  // GET /tickets/:id — detalle con comentarios e historial
fastify.get('/:id', async (req, reply) => {
  const { data, error } = await supa
    .from('tickets')
    .select(`
      id, title, description, status, priority, due_date, created_at, group_id,
      created_by:users!tickets_created_by_fkey(id, name, email),
      assigned_to:users!tickets_assigned_to_fkey(id, name, email),
      ticket_comments(
        id, text, created_at,
        users(id, name)
      ),
      ticket_history(
        id, field, from_value, to_value, changed_at,
        users(id, name)
      )
    `)
    .eq('id', req.params.id)
    .single();

  if (error || !data) return reply.status(404).send(R.notFound('Ticket no encontrado.'));
  return reply.send(R.ok(data, 'SxTK200'));
});

  // POST /tickets — crear ticket
  fastify.post('/', createSchema, async (req, reply) => {
    const { data, error } = await supa
      .from('tickets')
      .insert(req.body)
      .select('id, title, status')
      .single();

    if (error) return reply.status(400).send(R.badReq(error.message));
    return reply.status(201).send(R.created(data, 'SxTK201'));
  });

  // PUT /tickets/:id — editar datos del ticket
  fastify.put('/:id', updateSchema, async (req, reply) => {
    const { error } = await supa
      .from('tickets')
      .update(req.body)
      .eq('id', req.params.id);

    if (error) return reply.status(500).send(R.serverErr(error.message));
    return reply.send(R.ok({ message: 'Ticket actualizado.' }, 'SxTK200'));
  });

  // PATCH /tickets/:id/status — cambiar estado + historial
  fastify.patch('/:id/status', statusSchema, async (req, reply) => {
    const { from_status, to_status, user_id } = req.body;
    const id = req.params.id;

    const { error } = await supa.from('tickets').update({ status: to_status }).eq('id', id);
    if (error) return reply.status(500).send(R.serverErr(error.message));

    await supa.from('ticket_history').insert({
      ticket_id: Number(id), changed_by: user_id,
      field: 'status', from_value: from_status, to_value: to_status,
    });

    return reply.send(R.ok({ message: `Estado actualizado a ${to_status}.` }, 'SxTK200'));
  });

  // POST /tickets/:id/comments — agregar comentario
  fastify.post('/:id/comments', commentSchema, async (req, reply) => {
    const { user_id, text } = req.body;

    const { data, error } = await supa
      .from('ticket_comments')
      .insert({ ticket_id: Number(req.params.id), author_id: user_id, text })
      .select('id')
      .single();

    if (error) return reply.status(400).send(R.badReq(error.message));
    return reply.status(201).send(R.created({ id: data.id, message: 'Comentario agregado.' }, 'SxTK201'));
  });

  // DELETE /tickets/:id
  fastify.delete('/:id', async (req, reply) => {
    const { error } = await supa.from('tickets').delete().eq('id', req.params.id);
    if (error) return reply.status(500).send(R.serverErr(error.message));
    return reply.send(R.ok({ message: 'Ticket eliminado.' }, 'SxTK200'));
  });
}

module.exports = ticketsRoutes;