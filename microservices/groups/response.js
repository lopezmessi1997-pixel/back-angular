// Esquema de respuesta JSON universal del sistema
const reply = (statusCode, intOpCode, data) => ({ statusCode, intOpCode, data });

module.exports = {
  ok:        (data, code = 'SxGR200')  => reply(200, code, data),
  created:   (data, code = 'SxGR201')  => reply(201, code, data),
  badReq:    (msg,  code = 'SxGR400')  => reply(400, code, [{ error: msg }]),
  unauth:    (msg,  code = 'SxGR401')  => reply(401, code, [{ error: msg }]),
  forbidden: (msg,  code = 'SxGR403')  => reply(403, code, [{ error: msg }]),
  notFound:  (msg,  code = 'SxGR404')  => reply(404, code, [{ error: msg }]),
  serverErr: (msg,  code = 'SxGR500')  => reply(500, code, [{ error: msg }]),
};