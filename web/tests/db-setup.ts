/**
 * Setup compartido de base de test.
 *
 * `ensureTestDatabase()` garantiza que gestion_estacionamiento_test exista con
 * TODAS las migraciones aplicadas. Si la base ya está al día (misma cantidad de
 * migraciones que archivos en database/migrations), se reutiliza y se saltea el
 * drop/create/migrate. Así cada archivo de test no repite el setup.
 *
 * Guardia de seguridad: aborta si el nombre de la base no termina en "_test".
 */

import { Client, Pool } from 'pg';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  runMigrations,
  loadEnvLocal,
  listMigrationFiles,
} from '../../scripts/migrate.js';

export const TEST_DB = 'gestion_estacionamiento_test';

const SEED_SQL_PATH = path.resolve(
  process.cwd(),
  '../database/migrations/002_seed.sql',
);

let dbReady = false;

export function assertTestDatabase(database: string): void {
  if (!database.endsWith('_test')) {
    throw new Error(
      `SEGURIDAD: la base "${database}" no termina en "_test". ` +
        `Los tests solo pueden conectarse a bases de test.`,
    );
  }
}

async function crearBaseDesdeCero(): Promise<void> {
  const adminClient = new Client({
    host: process.env.PGHOST ?? '127.0.0.1',
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGADMIN_USER ?? process.env.USER,
    database: 'postgres',
  });
  await adminClient.connect();
  await adminClient.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await adminClient.query(`CREATE DATABASE ${TEST_DB}`);
  await adminClient.end();
}

async function baseEstaAlDia(): Promise<boolean> {
  const client = new Client({
    host: process.env.PGHOST ?? '127.0.0.1',
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGADMIN_USER ?? process.env.USER,
    database: TEST_DB,
  });
  try {
    await client.connect();
    const { rows } = await client.query<{ version: string }>(
      `SELECT version FROM schema_migrations`,
    );
    const esperadas = listMigrationFiles().map((m) => m.version);
    const aplicadas = new Set(rows.map((r) => r.version));
    return esperadas.every((v) => aplicadas.has(v));
  } catch {
    // La base no existe o schema_migrations no existe
    return false;
  } finally {
    await client.end();
  }
}

/**
 * Garantiza la base de test al día. Idempotente: si ya está lista, no toca nada.
 * Llamar desde global-setup y desde el beforeAll de cada archivo de test que
 * necesite la base (por si corre el archivo suelto con vitest run <file>).
 */
export async function ensureTestDatabase(): Promise<void> {
  loadEnvLocal();
  assertTestDatabase(TEST_DB);

  if (dbReady) return;
  if (await baseEstaAlDia()) {
    dbReady = true;
    return;
  }

  await crearBaseDesdeCero();
  await runMigrations(TEST_DB);
  dbReady = true;
}

/** Pool de app (app_estacionamiento) para tests. */
export function crearPoolApp(): Pool {
  return new Pool({
    host: process.env.PGHOST ?? '127.0.0.1',
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.APP_DB_USER ?? 'app_estacionamiento',
    password: process.env.APP_DB_PASSWORD,
    database: TEST_DB,
  });
}

/**
 * Limpia TODOS los datos de negocio de la base de TEST dejándola como recién
 * migrada (equivalente a recrearla, pero sin re-correr migraciones).
 *
 * - Corre como ADMIN (app_estacionamiento no tiene TRUNCATE, y está bien).
 * - Guard de seguridad: aborta si la base no termina en "_test".
 * - auditoria_cambios tiene triggers de inmutabilidad: se deshabilitan SOLO
 *   durante el TRUNCATE, dentro de esta transacción, SOLO en la base de test.
 */
export async function resetearDatosTest(): Promise<void> {
  assertTestDatabase(TEST_DB);

  const client = new Client({
    host: process.env.PGHOST ?? '127.0.0.1',
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGADMIN_USER ?? process.env.USER,
    database: TEST_DB,
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE auditoria_cambios DISABLE TRIGGER ALL');
    await client.query(`
      TRUNCATE auditoria_cambios, usuarios, clientes, vehiculos, plazas, tarifas,
               tipos_alquiler, configuracion_fiscal, categorias_gasto, gastos_compras,
               percepciones_iibb, saldos_iva, bot_conversaciones, rate_limit,
               password_reset_tokens
      RESTART IDENTITY CASCADE`);
    await client.query('ALTER TABLE auditoria_cambios ENABLE TRIGGER ALL');
    // Re-aplicar el seed (tipos_alquiler, categorias_gasto, configuracion_fiscal)
    await client.query(readFileSync(SEED_SQL_PATH, 'utf8'));
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}