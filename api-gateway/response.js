const reply = (statusCode, intOpCode, data) => ({ statusCode, intOpCode, data });

module.exports = {
  ok:        (data, code = 'SxGW200') => reply(200, code, data),
  created:   (data, code = 'SxGW201') => reply(201, code, data),
  badReq:    (msg,  code = 'SxGW400') => reply(400, code, [{ error: msg }]),
  unauth:    (msg,  code = 'SxGW401') => reply(401, code, [{ error: msg }]),
  forbidden: (msg,  code = 'SxGW403') => reply(403, code, [{ error: msg }]),
  notFound:  (msg,  code = 'SxGW404') => reply(404, code, [{ error: msg }]),
  tooMany:   (msg,  code = 'SxGW429') => reply(429, code, [{ error: msg }]),
  serverErr: (msg,  code = 'SxGW500') => reply(500, code, [{ error: msg }]),
};