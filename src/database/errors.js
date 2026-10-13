import { MongoError } from 'mongodb';

export class DatabaseUnavailableError extends Error {
  constructor(cause) {
    super('MongoDB o la colección inventario no están disponibles.', { cause });
    this.name = 'DatabaseUnavailableError';
    this.code = 'DATABASE_UNAVAILABLE';
  }
}

export async function withDatabaseErrors(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof MongoError) throw new DatabaseUnavailableError(error);
    throw error;
  }
}
