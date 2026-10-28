import "server-only";
import { Pool, type PoolClient } from "pg";

type GlobalWithPool = typeof globalThis & {
  __gestionEstacionamientoPool?: Pool;
};

const globalForPool = globalThis as GlobalWithPool;

function createPool(): Pool {
  const user = process.env.APP_DB_USER;
  const password = process.env.APP_DB_PASSWORD;
  const database = process.env.PGDATABASE;

  if (!user || !password || !database) {
    throw new Error(
      "Configuración de base incompleta: APP_DB_USER, APP_DB_PASSWORD y PGDATABASE son obligatorios.",
    );
  }

  return new Pool({
    host: process.env.PGHOST ?? "127.0.0.1",
    port: Number(process.env.PGPORT ?? 5432),
    user,
    password,
    database,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl:
      process.env.PGSSLMODE === "require"
        ? { rejectUnauthorized: false }
        : undefined,
  });
}

export function getPool(): Pool {
  globalForPool.__gestionEstacionamientoPool ??= createPool();
  return globalForPool.__gestionEstacionamientoPool;
}

export async function query<T>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query(text, params as unknown[]);
  return result.rows as T[];
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
