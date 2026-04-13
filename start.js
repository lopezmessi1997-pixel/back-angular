require('dotenv').config();

require('./microservices/users/server')
require('./microservices/tickets/server')
require('./microservices/groups/server')
require('./api-gateway/server') 