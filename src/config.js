import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { isIP } from 'node:net';

export function loadEnvironment(env = process.env) {
  dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), processEnv: env, quiet: true });
  return env;
}

export function loadConfig(env = process.env) {
  const uri = env.MONGODB_URI?.trim();
  if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri) || /[<>]/.test(uri)) {
    throw new Error('MONGODB_URI debe contener una conexión MongoDB válida, sin marcadores de ejemplo.');
  }
  const database = env.MONGODB_DB?.trim() || 'clase7_inventario';
  if (/[/\\. "$*<>:|?\x00]/.test(database)) {
    throw new Error('MONGODB_DB contiene caracteres inválidos.');
  }
  const port = env.PORT ?? '3000';
  if (!/^\d+$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('PORT debe ser un entero entre 1 y 65535.');
  }
  const origin = env.CORS_ORIGIN?.trim() || 'https://ms-ecommerce-dashboard.onrender.com';
  let parsedOrigin;
  try { parsedOrigin = new URL(origin); } catch { throw new Error('CORS_ORIGIN debe ser un origen HTTP válido.'); }
  if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== origin) {
    throw new Error('CORS_ORIGIN debe contener solo el origen HTTP, sin rutas ni credenciales.');
  }
  const dnsServers = env.MONGODB_DNS_SERVERS?.trim()
    ? env.MONGODB_DNS_SERVERS.split(',').map((server) => server.trim()) : [];
  if (dnsServers.some((server) => !isIP(server))) {
    throw new Error('MONGODB_DNS_SERVERS debe contener direcciones IP separadas por comas.');
  }
  return Object.freeze({
    MONGODB_URI: uri,
    MONGODB_DB: database,
    PORT: Number(port),
    SERVICE_NAME: env.SERVICE_NAME?.trim() || 'ms-inventario-ibarra-bassi',
    CORS_ORIGIN: origin,
    MONGODB_DNS_SERVERS: Object.freeze(dnsServers),
  });
}
