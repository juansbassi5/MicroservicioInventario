export function validateSeed(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('La semilla debe ser un arreglo no vacío.');
  const ids = new Set();
  const pairs = new Set();
  const fields = ['id', 'productoId', 'sucursalId', 'stock', 'stockMinimo', 'actualizado'];
  for (const [index, item] of items.entries()) {
    const fail = () => { throw new Error(`Documento inválido en la posición ${index + 1} de la semilla.`); };
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || Object.keys(item).length !== fields.length || !fields.every((field) => Object.hasOwn(item, field))) fail();
    for (const [field, prefix] of [['id', 'INV'], ['productoId', 'PRD'], ['sucursalId', 'SUC']]) {
      if (typeof item[field] !== 'string' || !new RegExp(`^${prefix}[0-9]+$`).test(item[field])) fail();
    }
    if (![item.stock, item.stockMinimo].every((value) => Number.isSafeInteger(value) && value >= 0)) fail();
    if (typeof item.actualizado !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(item.actualizado)) fail();
    const date = new Date(item.actualizado);
    if (!Number.isFinite(date.getTime()) || date.toISOString().replace('.000Z', 'Z') !== item.actualizado.replace('.000Z', 'Z')) fail();
    const pair = `${item.productoId}:${item.sucursalId}`;
    if (ids.has(item.id) || pairs.has(pair)) throw new Error(`Identificador o par producto-sucursal duplicado en la posición ${index + 1}.`);
    ids.add(item.id);
    pairs.add(pair);
  }
  return items;
}

export async function seedInventory(database, items) {
  validateSeed(items);
  const collection = database.collection('inventario');
  await collection.createIndex({ id: 1 }, { unique: true, name: 'inventario_id_unique' });
  await collection.createIndex({ productoId: 1, sucursalId: 1 }, { unique: true, name: 'inventario_producto_sucursal_unique' });
  const result = await collection.bulkWrite(items.map((item) => ({
    replaceOne: { filter: { id: item.id }, replacement: { ...item }, upsert: true },
  })), { ordered: true });
  return { processed: items.length, inserted: result.upsertedCount, modified: result.modifiedCount,
    total: await collection.countDocuments({}) };
}
