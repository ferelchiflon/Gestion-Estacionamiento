#!/usr/bin/env node
/**
 * Runner de migraciones PostgreSQL — Sistema de Gestión de Estacionamiento.
 * Uso (los comandos corren desde web/, donde vive package.json):
 *   npm run migrate -- --database gestion_estacionamiento_test
 *   node ../scripts/migrate.js --database gestion_estacionamiento_test
 *
 * Base REAL (gestion_estacionamiento), protegida por doble confirmación:
 *   node ../scripts/migrate.js --confirmar-real --database gestion_estacionamiento
 *       → SIMULACIÓN: lista las pendientes con su checksum, no aplica nada.
 *   node ../scripts/migrate.js --confirmar-real --aplicar --database gestion_estacionamiento
 *       → aplica de verdad. Exige un backup .sql de MENOS de 24 horas y MAYOR
 *         a 10 KB en ~/backups ($MIGRATE_BACKUPS_DIR lo sobreescribe, sólo tests).
 *   --confirmar-real fuerza este flujo seguro sobre la base que se le pase
 *   (los tests lo ejercitan contra bases _test); sin el flag, las bases
 *   que no terminan en "_test" siguen bloqueadas.
 *
 * - Aplica database/migrations/NNN_*.sql en orden, una vez cada una.
 * - Cada migración corre en su PROPIA transacción: si una falla, rollback de
 *   esa migración y se corta; las ya aplicadas quedan aplicadas.
 * - Registra version + checksum sha256 en schema_migrations.
 * - Aborta si una migración ya aplicada cambió su checksum (drift).
 * - El password del rol app se inyecta en :'app_password' desde .env.local
 *   (compatible también con: psql -v app_password="..." -f <archivo>).
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'database', 'migrations');
const BACKUP_EDAD_MAX_MS = 24 * 60 * 60 * 1000; // 24 horas
const BACKUP_TAM_MIN_BYTES = 10 * 1024;         // 10 KB

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

function assertTestDatabase(database) {
  if (!database.endsWith('_test')) {
    throw new Error(
      `SEGURIDAD: Se intentó migrar una base que NO termina en '_test'.\n` +
      `Base objetivo: ${database}\n` +
      `Esto protegería la base real (gestion_estacionamiento) de escrituras accidentales.\n` +
      `Para bases de test: --database gestion_estacionamiento_test (o define PGDATABASE).\n` +
      `Para la base REAL: agregá --confirmar-real (simulación) y --aplicar (ejecutar).\n` +
      `La base real exige un backup .sql de menos de 24 horas y mayor a 10 KB en ~/backups.`
    );
  }
}

/** Directorio de backups: ~/backups por defecto ($MIGRATE_BACKUPS_DIR: sólo tests). */
function directorioBackups() {
  return process.env.MIGRATE_BACKUPS_DIR || path.join(os.homedir(), 'backups');
}

/**
 * (a) Busca un backup .sql con MENOS de 24 horas y MAYOR a 10 KB.
 *     Devuelve el más reciente que cumpla, o { ok: false, motivo }.
 */
function buscarBackupReciente(dir) {
  if (!fs.existsSync(dir)) {
    return { ok: false, motivo: `no existe el directorio de backups ${dir}` };
  }
  const ahora = Date.now();
  const validos = fs.readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .map((f) => {
      const st = fs.statSync(path.join(dir, f));
      return { archivo: path.join(dir, f), bytes: st.size, edadMs: ahora - st.mtimeMs };
    })
    .filter((b) => b.bytes > BACKUP_TAM_MIN_BYTES && b.edadMs < BACKUP_EDAD_MAX_MS)
    .sort((a, b) => a.edadMs - b.edadMs);

  if (validos.length === 0) {
    return { ok: false, motivo: 'no hay ningún .sql con menos de 24 horas y mayor a 10 KB' };
  }
  return { ok: true, cantidad: validos.length, ...validos[0] };
}

function fmtKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function fmtEdad(ms) {
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}
/**
 * Estado de migraciones aplicadas, SOLO LECTURA (no crea schema_migrations).
 * Si la tabla todavía no existe, devuelve un Map vacío (nada aplicado aún).
 */
async function leerEstadoAplicadas(database) {
  const client = await connectAdmin(database);
  try {
    const { rows } = await client.query('SELECT version, checksum FROM schema_migrations');
    return new Map(rows.map((r) => [r.version, r.checksum]));
  } catch (err) {
    if (err && err.code === '42P01') return new Map(); // relation does not exist
    throw err;
  } finally {
    await client.end();
  }
}

/** Compara archivos vs aplicadas: { pendientes, drift }. No toca la base. */
function calcularPendientes(aplicadas) {
  const pendientes = [];
  const drift = [];
  for (const mig of listMigrationFiles()) {
    const checksum = sha256(mig.sql);
    const enBase = aplicadas.get(mig.version);
    if (enBase === undefined) {
      pendientes.push({ file: mig.file, version: mig.version, checksum });
    } else if (enBase !== checksum) {
      drift.push({ version: mig.version, enBase, enArchivo: checksum });
    }
  }
  return { pendientes, drift };
}

/** (b) Imprime las pendientes con su checksum (y el drift, si hay). */
function imprimirPlan(pendientes, drift) {
  console.log(`  Migraciones pendientes: ${pendientes.length}`);
  for (const p of pendientes) {
    console.log(`    > ${p.version}`);
    console.log(`        sha256 ${p.checksum}  (${p.file})`);
  }
  if (pendientes.length === 0) console.log('    (ninguna: la base está al día)');
  if (drift.length > 0) {
    console.log(`  DRIFT: ${drift.length} migración(es) YA APLICADAS cambiaron su checksum:`);
    for (const d of drift) {
      console.log(`    ! ${d.version}`);
      console.log(`        en base:    ${d.enBase}`);
      console.log(`        en archivo: ${d.enArchivo}`);
    }
  }
}

/**
 * Flujo para la base REAL con --confirmar-real: imprime el plan (b) y,
 * sin --aplicar, se queda en SIMULACIÓN (c): no ejecuta ni modifica nada.
 * Con --aplicar delega en runMigrations (transacción por migración + drift).
 */
async function flujoReal(database, aplicar) {
  const aplicadas = await leerEstadoAplicadas(database);
  const { pendientes, drift } = calcularPendientes(aplicadas);
  console.log(`  Migraciones ya aplicadas: ${aplicadas.size}`);
  imprimirPlan(pendientes, drift);
  if (drift.length > 0) {
    throw new Error('Drift detectado: una migración ya aplicada cambió su contenido. Abortando.');
  }
  if (!aplicar) {
    console.log('\n  SIMULACIÓN OK. No se ejecutó ni modificó nada (falta --aplicar).');
    return 0;
  }
  console.log('\n  --aplicar: aplicando migraciones pendientes...');
  return runMigrations(database);
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
      // Cada migración en SU PROPIA transacción: si falla, rollback de esa
      // migración y se corta; las anteriores quedan aplicadas.
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

module.exports = {
  runMigrations,
  loadEnvLocal,
  sha256,
  listMigrationFiles,
  assertTestDatabase,
  buscarBackupReciente,
};

function morir(err) {
  console.error(`\nERROR: ${err && err.message ? err.message : err}`);
  process.exit(1);
}

if (require.main === module) {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const i = args.indexOf('--database');
  let database;
  if (i !== -1) {
    if (!args[i + 1]) {
      console.error('ERROR: --database requiere un valor.');
      process.exit(1);
    }
    database = args[i + 1];
  } else {
    database = process.env.PGDATABASE || 'gestion_estacionamiento';
  }
  const confirmarReal = args.includes('--confirmar-real');
  const aplicar = args.includes('--aplicar');
  const esTest = database.endsWith('_test');

  console.log(`Migraciones — base objetivo: ${database}`);

  if (confirmarReal) {
    // --confirmar-real fuerza el flujo seguro sobre la base indicada (real o
    // de test: los tests lo ejercitan contra bases _test): (a) exige backup
    // reciente, (b) imprime el plan con checksums, (c) simula salvo --aplicar.
    const dir = directorioBackups();
    const backup = buscarBackupReciente(dir);
    if (!backup.ok) {
      console.error(`\nERROR: --confirmar-real exige un backup reciente de "${database}".`);
      console.error(`  Motivo: ${backup.motivo} (${dir}).`);
      console.error('  Creá uno fresco, por ejemplo:');
      console.error(`    pg_dump "${database}" > "${dir}/gestion_estacionamiento_$(date +%Y%m%d_%H%M%S).sql"`);
      process.exit(1);
    }
    console.log(`  Backup OK: ${backup.archivo}`);
    console.log(`             ${fmtKB(backup.bytes)}, hace ${fmtEdad(backup.edadMs)}${backup.cantidad > 1 ? ` (${backup.cantidad} backups válidos)` : ''}`);

    flujoReal(database, aplicar)
      .then((n) => { console.log(`\nListo. Migraciones nuevas aplicadas: ${n}`); process.exit(0); })
      .catch(morir);
  } else if (esTest) {
    // Sin el flag: las bases de test migran directo (comportamiento de siempre).
    assertTestDatabase(database);
    runMigrations(database)
      .then((n) => { console.log(`\nListo. Migraciones nuevas aplicadas: ${n}`); process.exit(0); })
      .catch(morir);
  } else {
    // Sin el flag, la base real sigue bloqueada (guarda por defecto).
    try {
      assertTestDatabase(database);
      process.exit(1); // inalcanzable: assertTestDatabase lanza para bases no-test
    } catch (err) {
      morir(err);
    }
  }
}
