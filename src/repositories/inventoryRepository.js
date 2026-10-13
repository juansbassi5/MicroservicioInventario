import { DatabaseUnavailableError, withDatabaseErrors } from '../database/errors.js';

export const COLLECTION_NAME = 'inventario';
export const ITEM_PROJECTION = Object.freeze({
  _id: 0, id: 1, productoId: 1, sucursalId: 1, stock: 1, stockMinimo: 1, actualizado: 1,
});

export function createInventoryRepository(database) {
  const collection = database.collection(COLLECTION_NAME);
  const options = { maxTimeMS: 2000 };
  return {
    async list({ productoId, sucursalId, limit = 20, offset = 0 } = {}) {
      const filter = {};
      if (productoId !== undefined) filter.productoId = productoId;
      if (sucursalId !== undefined) filter.sucursalId = sucursalId;
      return withDatabaseErrors(async () => {
        const [items, total] = await Promise.all([
          collection.find(filter, { ...options, projection: ITEM_PROJECTION })
            .sort({ id: 1 }).skip(offset).limit(limit).toArray(),
          collection.countDocuments(filter, options),
        ]);
        return { items, total };
      });
    },
    async getById(id) {
      return withDatabaseErrors(() => collection.findOne({ id }, { ...options, projection: ITEM_PROJECTION }));
    },
    async checkHealth() {
      return withDatabaseErrors(async () => {
        await database.command({ ping: 1 }, options);
        const collections = await database.listCollections(
          { name: COLLECTION_NAME }, { ...options, nameOnly: true, authorizedCollections: true },
        ).toArray();
        if (collections.length === 0) throw new DatabaseUnavailableError();
        // Leer un documento también verifica el permiso de lectura, incluso en una colección vacía.
        await collection.findOne({}, { ...options, projection: { _id: 1 } });
      });
    },
  };
}
