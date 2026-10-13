import { MongoClient } from 'mongodb';
import { DatabaseUnavailableError } from './errors.js';
import { promises as dns } from 'node:dns';

export const MONGO_OPTIONS = Object.freeze({
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  socketTimeoutMS: 10000,
  waitQueueTimeoutMS: 5000,
  maxPoolSize: 10,
  minPoolSize: 0,
});

export async function connectToMongo(config, { Client = MongoClient } = {}) {
  let client;
  try {
    // Solo modifica el resolver de este proceso, nunca la configuración del sistema.
    if (config.MONGODB_DNS_SERVERS?.length) dns.setServers(config.MONGODB_DNS_SERVERS);
    client = new Client(config.MONGODB_URI, MONGO_OPTIONS);
    await client.connect();
    const database = client.db(config.MONGODB_DB);
    await database.command({ ping: 1 }, { maxTimeMS: 2000 });
    return { client, database };
  } catch (error) {
    await client?.close().catch(() => {});
    throw new DatabaseUnavailableError(error);
  }
}
