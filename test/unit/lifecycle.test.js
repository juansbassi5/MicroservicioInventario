import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { connectToMongo } from '../../src/database/mongo.js';
import { startServer } from '../../src/server.js';

test('conexión fallida cierra el cliente y entrega un error sin URI en su mensaje', async () => {
  let closed = false;
  class FailingClient {
    async connect() { throw new Error('falló la conexión'); }
    async close() { closed = true; }
  }
  await assert.rejects(connectToMongo({ MONGODB_URI: 'mongodb://localhost:27017', MONGODB_DB: 'test' }, { Client: FailingClient }), { code: 'DATABASE_UNAVAILABLE' });
  assert.equal(closed, true);
});

function fakeConnection() {
  let closed = 0;
  return {
    connection: {
      client: { async close() { closed += 1; } },
      database: {
        collection: () => ({ async findOne() { return null; } }),
        async command() {},
        listCollections: () => ({ async toArray() { return [{ name: 'inventario' }]; } }),
      },
    },
    closed: () => closed,
  };
}

test('arranque inyecta dependencias y cierre repetido libera una sola vez el cliente', async () => {
  const fixture = fakeConnection();
  const config = { PORT: 0, SERVICE_NAME: 'test', CORS_ORIGIN: 'https://example.com' };
  const running = await startServer(config, {
    connect: async () => fixture.connection,
    buildApp(dependencies) {
      assert.equal(dependencies.config, config);
      assert.equal(typeof dependencies.inventoryRepository.list, 'function');
      return express();
    },
  });
  assert.ok(running.server.listening);
  assert.equal(running.server.address().address, '0.0.0.0');
  await Promise.all([running.stop(), running.stop()]);
  assert.equal(running.server.listening, false);
  assert.equal(fixture.closed(), 1);
});

test('si falla construir la aplicación, el arranque cierra MongoDB', async () => {
  const fixture = fakeConnection();
  await assert.rejects(startServer({ PORT: 0 }, {
    connect: async () => fixture.connection,
    buildApp() { throw new Error('aplicación inválida'); },
  }), /aplicación inválida/);
  assert.equal(fixture.closed(), 1);
});

test('un puerto ocupado rechaza el arranque y libera la conexión MongoDB', async () => {
  const occupied = express().listen(0, '0.0.0.0');
  await new Promise((resolve) => occupied.once('listening', resolve));
  const fixture = fakeConnection();
  try {
    await assert.rejects(startServer({ PORT: occupied.address().port }, {
      connect: async () => fixture.connection,
      buildApp: () => express(),
    }), { code: 'EADDRINUSE' });
    assert.equal(fixture.closed(), 1);
  } finally {
    await new Promise((resolve) => occupied.close(resolve));
  }
});
