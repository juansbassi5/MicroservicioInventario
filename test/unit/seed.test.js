import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { seedInventory, validateSeed } from '../../src/seed.js';

const items = JSON.parse(await readFile(new URL('../../inventario.json', import.meta.url), 'utf8'));

test('la semilla entregada contiene 97 filas válidas y conserva fechas e identificadores', () => {
  assert.equal(validateSeed(items).length, 97);
  assert.equal(items[0].sucursalId, 'SUC01');
  assert.equal(items[0].actualizado, '2026-10-10T06:00:00Z');
});

test('validación rechaza duplicados, cantidades inválidas y fechas inexistentes antes de escribir', async () => {
  for (const change of [
    { stock: -1 }, { stock: 1.5 }, { stockMinimo: '5' }, { sucursalId: 'SUC' },
    { actualizado: '2026-02-30T06:00:00Z' }, { actualizado: 'ayer' }, { extra: true },
  ]) {
    assert.throws(() => validateSeed([{ ...items[0], ...change }]), /inválido/);
  }
  assert.throws(() => validateSeed([items[0], items[0]]), /duplicado/);
  assert.throws(() => validateSeed([items[0], { ...items[0], id: 'INV999' }]), /duplicado/);
  let touchedDatabase = false;
  await assert.rejects(seedInventory({ collection() { touchedDatabase = true; } }, []));
  assert.equal(touchedDatabase, false);
});

test('carga usa índices únicos y reemplazos con upsert por id sin borrar la colección', async () => {
  const indexes = [];
  let writes;
  const collection = {
    async createIndex(keys, options) { indexes.push({ keys, options }); },
    async bulkWrite(operations) { writes = operations; return { upsertedCount: 1, modifiedCount: 0 }; },
    async countDocuments() { return 1; },
  };
  const result = await seedInventory({ collection: () => collection }, [items[0]]);
  assert.deepEqual(indexes.map(({ keys, options }) => [keys, options.unique]), [[{ id: 1 }, true], [{ productoId: 1, sucursalId: 1 }, true]]);
  assert.deepEqual(writes, [{ replaceOne: { filter: { id: 'INV001' }, replacement: items[0], upsert: true } }]);
  assert.deepEqual(result, { processed: 1, inserted: 1, modified: 0, total: 1 });
});
