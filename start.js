require('dotenv').config();

// levantar microservicios internos
require('./microservices/users/Server')
require('./microservices/tickets/Server')
require('./microservices/groups/Server')

// levantar gateway
require('./api-gateway/Server');