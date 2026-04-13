// Esquema de respuesta JSON universal del sistema
const reply = (statusCode, intOpCode, data) => ({ statusCode, intOpCode, data });

module.exports = {
  ok:        (data, code = 'SxUS200')  => reply(200, code, data),
  created:   (data, code = 'SxUS201')  => reply(201, code, data),
  badReq:    (msg,  code = 'SxUS400')  => reply(400, code, [{ error: msg }]),
  unauth:    (msg,  code = 'SxUS401')  => reply(401, code, [{ error: msg }]),
  forbidden: (msg,  code = 'SxUS403')  => reply(403, code, [{ error: msg }]),
  notFound:  (msg,  code = 'SxUS404')  => reply(404, code, [{ error: msg }]),
  serverErr: (msg,  code = 'SxUS500')  => reply(500, code, [{ error: msg }]),
};