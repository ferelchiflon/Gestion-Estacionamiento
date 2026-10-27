#!/usr/bin/env node
/**
 * Runner de migraciones PostgreSQL — Sistema de Gestión de Estacionamiento.
 *
 * Uso:
 *   npm run migrate                  # base de .env.local (PGDATABASE)
 *   node scripts/migrate.js --database gestion_estacionamiento_test
 *
 * - Aplica database/migrations/NNN_*.sql en orden, una vez cada una.
 * - Registra version + checksum sha256 en schema_migrations.
 * - Aborta si una migración ya aplicada cambió su checksum (drift).
 * - El password del rol app se inyecta en :'app_password' desde .env.local
 *   (compatible también con: psql -v app_password="..." -f <archivo>).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'database', 'migrations');

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: no existe .env.local en la raíz del proyecto (ver README.md).');
    process.exit(1);
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function listMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_[a-z0-9_]+\.sql$/i.test(f))
    .sort()
    .map((f) => ({
      file: f,
      version: f.replace(/\.sql$/, ''),
      sql: fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'),
    }));
}

function injectAppPassword(sql) {
  if (!sql.includes(":'app_password'")) return sql;
  const pw = process.env.APP_DB_PASSWORD;
  if (!pw) {
    throw new Error("La migración usa :'app_password' pero APP_DB_PASSWORD no está definida en .env.local");
  }
  return sql.replace(/:'app_password'/g, `'${String(pw).replace(/'/g, "''")}'`);
}

async function connectAdmin(database) {
  const client = new Client({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGADMIN_USER || 'macbook',
    database,
  });
  await client.connect();
  return client;
}

async function runMigrations(database) {
  const client = await connectAdmin(database);
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        version    text PRIMARY KEY,
        checksum   text,
        applied_at timestamp with time zone NOT NULL DEFAULT now()
    )`);

    const { rows: applied } = await client.query('SELECT version, checksum FROM schema_migrations');
    const appliedMap = new Map(applied.map((r) => [r.version, r.checksum]));
    const migrations = listMigrationFiles();
    let nuevas = 0;

    for (const mig of migrations) {
      const checksum = sha256(mig.sql);
      const previa = appliedMap.get(mig.version);
      if (previa === checksum) {
        console.log(`  = ${mig.version}  (ya aplicada, checksum coincide)`);
        continue;
      }
      if (previa !== undefined) {
        throw new Error(`${mig.version}: el checksum del archivo cambió respecto del registrado en la base (drift). Abortando.`);
      }
      console.log(`  > ${mig.version}  aplicando...`);
      await client.query('BEGIN');
      try {
        await client.query(injectAppPassword(mig.sql));
        await client.query(
          'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
          [mig.version, checksum]
        );
        await client.query('COMMIT');
        console.log(`    OK (sha256 ${checksum.slice(0, 12)}...)`);
        nuevas++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`${mig.version} falló: ${err.message}`);
      }
    }

    const { rows: registro } = await client.query(
      'SELECT version, left(checksum, 12) AS checksum, applied_at FROM schema_migrations ORDER BY version'
    );
    console.log('\n  schema_migrations:');
    for (const r of registro) console.log(`    ${r.version.padEnd(24)} ${r.checksum}  ${r.applied_at.toISOString()}`);
    return nuevas;
  } finally {
    await client.end();
  }
}

module.exports = { runMigrations, loadEnvLocal, sha256, listMigrationFiles };

if (require.main === module) {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const i = args.indexOf('--database');
  const database = i !== -1 ? args[i + 1] : (process.env.PGDATABASE || 'gestion_estacionamiento');
  console.log(`Migrando base: ${database}`);
  runMigrations(database)
    .then((n) => { console.log(`\nListo. Migraciones nuevas aplicadas: ${n}`); process.exit(0); })
    .catch((err) => { console.error(`\nERROR: ${err.message}`); process.exit(1); });
}
