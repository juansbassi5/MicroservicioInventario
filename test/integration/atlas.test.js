import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadConfig, loadEnvironment } from '../../src/config.js';
import { connectToMongo } from '../../src/database/mongo.js';
import { createInventoryRepository } from '../../src/repositories/inventoryRepository.js';

const seed = JSON.parse(await readFile(new URL('../../inventario.json', import.meta.url), 'utf8'));
let connection;
let repository;

before(async () => {
  try {
    connection = await connectToMongo(loadConfig(loadEnvironment()));
    repository = createInventoryRepository(connection.database);
  } catch {
    throw new Error('No se pudo conectar a Atlas. Revisá .env, credenciales e IP Access List.');
  }
});
after(async () => { if (connection) await connection.client.close(); });

test('Atlas: colección disponible y semilla completa sin campos internos', async () => {
  await repository.checkHealth();
  const result = await repository.list({ limit: 100, offset: 0 });
  assert.equal(result.total, 97);
  assert.deepEqual(result.items, [...seed].sort((a, b) => a.id.localeCompare(b.id)));
});

test('Atlas: paginación independiente del total y detalle por id público', async () => {
  const page = await repository.list({ limit: 5, offset: 5 });
  assert.equal(page.total, 97);
  assert.deepEqual(page.items.map((item) => item.id), ['INV006', 'INV007', 'INV008', 'INV009', 'INV010']);
  assert.deepEqual(await repository.getById('INV001'), seed[0]);
  assert.equal(await repository.getById('INV999'), null);
});

test('Atlas: filtros AND, resultados inexistentes y offset fuera de rango', async () => {
  assert.equal((await repository.list({ productoId: 'PRD001' })).total, 3);
  const pair = await repository.list({ productoId: 'PRD001', sucursalId: 'SUC02' });
  assert.equal(pair.total, 1);
  assert.equal(pair.items[0].id, 'INV002');
  assert.deepEqual(await repository.list({ productoId: 'PRD999' }), { items: [], total: 0 });
  assert.deepEqual(await repository.list({ offset: 1000 }), { items: [], total: 97 });
});
