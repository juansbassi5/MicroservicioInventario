import express from 'express';

// Punto de integración de Bassi: agregar aquí las rutas, validaciones, CORS y errores.
// El servidor entrega una conexión operativa a través del repositorio y la configuración.
export function createApp({ inventoryRepository, config }) {
  if (!inventoryRepository || !config) throw new TypeError('Faltan las dependencias de la aplicación.');
  const app = express();
  app.disable('x-powered-by');
  app.locals.inventoryRepository = inventoryRepository;
  app.locals.config = config;
  app.use(express.json());
  return app;
}
