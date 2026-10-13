import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../../src/config.js';

const env = { MONGODB_URI: 'mongodb://localhost:27017' };

test('configuración con URI sola utiliza la base acordada y valores predeterminados', () => {
  const config = loadConfig(env);
  assert.equal(config.MONGODB_DB, 'clase7_inventario');
  assert.equal(config.PORT, 3000);
  assert.equal(config.SERVICE_NAME, 'ms-inventario-ibarra-bassi');
  assert.equal(config.CORS_ORIGIN, 'https://ms-ecommerce-dashboard.onrender.com');
  assert.ok(Object.isFrozen(config));
});

test('configuración respeta variables de Render y rechaza valores inválidos', () => {
  assert.equal(loadConfig({ ...env, PORT: '10000', MONGODB_DB: 'otra_base' }).PORT, 10000);
  for (const PORT of ['', '0', '-1', '3000abc', '1.5', '65536']) {
    assert.throws(() => loadConfig({ ...env, PORT }), /PORT/);
  }
  for (const MONGODB_URI of ['', 'https://example.com', 'mongodb+srv://<usuario>:<password>@host/']) {
    assert.throws(() => loadConfig({ MONGODB_URI }), /MONGODB_URI/);
  }
  assert.throws(() => loadConfig({ ...env, MONGODB_DB: 'base/invalida' }), /MONGODB_DB/);
  for (const CORS_ORIGIN of ['*', 'https://example.com/ruta', 'https://u:p@example.com', 'file:///tmp']) {
    assert.throws(() => loadConfig({ ...env, CORS_ORIGIN }), /CORS_ORIGIN/);
  }
});
