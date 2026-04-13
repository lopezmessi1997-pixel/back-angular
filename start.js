require('dotenv').config();

// levantar microservicios internos
require('./microservices/users/server')
require('./microservices/tickets/server')
require('./microservices/groups/server')

// levantar gateway
require('./api-gateway/server');