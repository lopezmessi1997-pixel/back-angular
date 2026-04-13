const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── Insertar log en Supabase ──────────────────────────────────────────────────
async function saveLog({ endpoint, method, username, ip, status, duration_ms, user_agent, error, stack_trace }) {
  try {
    await supabase.from('request_logs').insert({
      endpoint, method, username, ip, status,
      duration_ms, user_agent, error, stack_trace,
    });
  } catch (err) {
    // No bloquear el request si falla el log
    console.error('[Logger] Error guardando log:', err.message);
  }
}

// ── Hook onRequest: marca el tiempo de inicio ─────────────────────────────────
async function onRequestHook(req, reply) {
  req.startTime = Date.now();
}

// ── Hook onResponse: guarda el log completo ───────────────────────────────────
async function onResponseHook(req, reply) {
  const duration_ms = Date.now() - (req.startTime ?? Date.now());
  const endpoint    = req.url.split('?')[0];
  const username    = req.user?.username ?? null;
  const ip          = req.headers['x-forwarded-for'] ?? req.ip ?? null;

  await saveLog({
    endpoint,
    method:     req.method,
    username,
    ip,
    status:     reply.statusCode,
    duration_ms,
    user_agent: req.headers['user-agent'] ?? null,
    error:      null,
    stack_trace: null,
  });
}

// ── Hook onError: guarda errores con stack trace ──────────────────────────────
async function onErrorHook(req, reply, error) {
  const duration_ms = Date.now() - (req.startTime ?? Date.now());
  const endpoint    = req.url.split('?')[0];
  const username    = req.user?.username ?? null;
  const ip          = req.headers['x-forwarded-for'] ?? req.ip ?? null;

  await saveLog({
    endpoint,
    method:      req.method,
    username,
    ip,
    status:      reply.statusCode ?? 500,
    duration_ms,
    user_agent:  req.headers['user-agent'] ?? null,
    error:       error.message,
    stack_trace: error.stack ?? null,
  });
}

module.exports = { onRequestHook, onResponseHook, onErrorHook };