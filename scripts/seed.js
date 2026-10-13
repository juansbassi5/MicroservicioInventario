import { readFile } from 'node:fs/promises';
import { loadEnvironment, loadConfig } from '../src/config.js';
import { connectToMongo } from '../src/database/mongo.js';
import { seedInventory, validateSeed } from '../src/seed.js';

let connection;
try {
  const config = loadConfig(loadEnvironment());
  const items = validateSeed(JSON.parse(await readFile(new URL('../inventario.json', import.meta.url), 'utf8')));
  connection = await connectToMongo(config);
  const result = await seedInventory(connection.database, items);
  console.log(JSON.stringify({ database: config.MONGODB_DB, collection: 'inventario', ...result }));
} catch {
  console.error('No se pudo cargar la semilla. Verificá su formato, los índices y el acceso de escritura a MongoDB.');
  process.exitCode = 1;
} finally {
  if (connection) await connection.client.close();
}
