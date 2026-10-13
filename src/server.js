import { pathToFileURL } from 'node:url';
import { loadConfig, loadEnvironment } from './config.js';
import { connectToMongo } from './database/mongo.js';
import { createInventoryRepository } from './repositories/inventoryRepository.js';
import { createApp } from './app.js';

export async function startServer(config, { connect = connectToMongo, buildApp = createApp } = {}) {
  const connection = await connect(config);
  let server;
  try {
    const inventoryRepository = createInventoryRepository(connection.database);
    await inventoryRepository.checkHealth();
    const app = buildApp({ inventoryRepository, config });
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(config.PORT, '0.0.0.0', (error) => error ? reject(error) : resolve(listener));
      listener.once('error', reject);
    });
  } catch (error) {
    await connection.client.close();
    throw error;
  }
  let stopping;
  function stop() {
    stopping ??= (async () => {
      try {
        await new Promise((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve());
          server.closeIdleConnections();
        });
      } finally {
        await connection.client.close();
      }
    })();
    return stopping;
  }
  return { server, stop };
}

async function main() {
  try {
    const config = loadConfig(loadEnvironment());
    const running = await startServer(config);
    console.log(`${config.SERVICE_NAME} escuchando en 0.0.0.0:${running.server.address().port}`);
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, () => {
        const timeout = setTimeout(() => process.exit(1), 10000).unref();
        running.stop().then(() => clearTimeout(timeout), () => {
          console.error('No se pudo cerrar el servicio correctamente.');
          process.exitCode = 1;
        });
      });
    }
  } catch {
    console.error('No se pudo iniciar el servicio. Revisá la configuración, el acceso a Atlas y la carga de inventario.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
