require('dotenv').config();

async function main() {
  try {
    // Levantar microservicios internos primero
    await require('./microservices/users/server');
    await require('./microservices/tickets/server');
    await require('./microservices/groups/server');

    // Levantar gateway al final
    await require('./api-gateway/server');

    console.log('✅ Todos los servicios corriendo');
  } catch (err) {
    console.error('❌ Error al iniciar:', err);
    process.exit(1);
  }
}

main();