import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoServerError } from 'mongodb';
import { createInventoryRepository, ITEM_PROJECTION } from '../../src/repositories/inventoryRepository.js';

test('listado transmite filtros AND, orden, paginación y proyección; total no se pagina', async () => {
  const calls = [];
  const item = { id: 'INV002', productoId: 'PRD001', sucursalId: 'SUC02' };
  const cursor = {
    sort(value) { calls.push(['sort', value]); return this; },
    skip(value) { calls.push(['skip', value]); return this; },
    limit(value) { calls.push(['limit', value]); return this; },
    async toArray() { return [item]; },
  };
  const database = { collection(name) {
    assert.equal(name, 'inventario');
    return {
      find(filter, options) { calls.push(['find', filter, options]); return cursor; },
      async countDocuments(filter, options) { calls.push(['count', filter, options]); return 3; },
    };
  } };
  const result = await createInventoryRepository(database).list({ productoId: 'PRD001', sucursalId: 'SUC02', limit: 5, offset: 10 });
  assert.deepEqual(result, { items: [item], total: 3 });
  assert.deepEqual(calls.find(([name]) => name === 'find'), ['find', { productoId: 'PRD001', sucursalId: 'SUC02' }, { maxTimeMS: 2000, projection: ITEM_PROJECTION }]);
  assert.deepEqual(calls.find(([name]) => name === 'count'), ['count', { productoId: 'PRD001', sucursalId: 'SUC02' }, { maxTimeMS: 2000 }]);
  assert.deepEqual(calls.filter(([name]) => ['sort', 'skip', 'limit'].includes(name)), [['sort', { id: 1 }], ['skip', 10], ['limit', 5]]);
  assert.equal(ITEM_PROJECTION._id, 0);
});

test('detalle consulta el identificador público y devuelve null si no existe', async () => {
  const repository = createInventoryRepository({ collection: () => ({
    async findOne(filter, options) {
      assert.deepEqual(filter, { id: 'INV999' });
      assert.deepEqual(options.projection, ITEM_PROJECTION);
      return null;
    },
  }) });
  assert.equal(await repository.getById('INV999'), null);
});

test('errores MongoDB se identifican sin ocultar errores de programación', async () => {
  const mongoError = new MongoServerError({ message: 'not authorized', code: 13 });
  const database = { collection: () => ({ async findOne() { throw mongoError; } }) };
  await assert.rejects(createInventoryRepository(database).getById('INV001'), { code: 'DATABASE_UNAVAILABLE' });
  const programmingError = new TypeError('error de programación');
  database.collection = () => ({ async findOne() { throw programmingError; } });
  await assert.rejects(createInventoryRepository(database).getById('INV001'), (error) => error === programmingError);
});

test('health falla si falta la colección y comprueba lectura cuando existe', async () => {
  let names = [];
  let reads = 0;
  const database = {
    collection: () => ({ async findOne() { reads += 1; return null; } }),
    async command(command) { assert.deepEqual(command, { ping: 1 }); },
    listCollections: () => ({ async toArray() { return names; } }),
  };
  const repository = createInventoryRepository(database);
  await assert.rejects(repository.checkHealth(), { code: 'DATABASE_UNAVAILABLE' });
  assert.equal(reads, 0);
  names = [{ name: 'inventario' }];
  await repository.checkHealth();
  assert.equal(reads, 1);
});
