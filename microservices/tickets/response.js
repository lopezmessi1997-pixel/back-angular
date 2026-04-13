// Esquema de respuesta JSON universal del sistema
const reply = (statusCode, intOpCode, data) => ({ statusCode, intOpCode, data });

module.exports = {
  ok:        (data, code = 'SxTK200')  => reply(200, code, data),
  created:   (data, code = 'SxTK201')  => reply(201, code, data),
  badReq:    (msg,  code = 'SxTK400')  => reply(400, code, [{ error: msg }]),
  unauth:    (msg,  code = 'SxTK401')  => reply(401, code, [{ error: msg }]),
  forbidden: (msg,  code = 'SxTK403')  => reply(403, code, [{ error: msg }]),
  notFound:  (msg,  code = 'SxTK404')  => reply(404, code, [{ error: msg }]),
  serverErr: (msg,  code = 'SxTK500')  => reply(500, code, [{ error: msg }]),
};