const fetch = require('node-fetch');
const R     = require('./response');

// Proxy genérico — reenvía el request al microservicio correspondiente
async function proxyRequest(req, reply, targetUrl) {
  try {
    const url  = targetUrl + req.url.replace('/api', '');
    const body = ['GET', 'DELETE'].includes(req.method) ? undefined : JSON.stringify(req.body);

    const headers = {
      'Content-Type': 'application/json',
      // Propagar el usuario decodificado del JWT hacia los microservicios
      'x-user-id':   req.user?.userId  ?? '',
      'x-user-perms': JSON.stringify(req.user?.perms ?? []),
    };

    const response = await fetch(url, { method: req.method, headers, body });
    const data     = await response.json();

    return reply.status(response.status).send(data);
  } catch (err) {
    return reply.status(502).send(R.serverErr(`Microservicio no disponible: ${err.message}`));
  }
}

module.exports = proxyRequest;