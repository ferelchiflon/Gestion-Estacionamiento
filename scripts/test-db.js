'use strict';

/**
 * test-db.js — Pruebas de integridad y permisos del módulo 0.
 *
 * Ejecuta TODO sobre un servidor PostgreSQL efímero e independiente
 * (datos en /tmp, puerto libre, base gestion_estacionamiento_test),
 * aplicando las mismas migraciones 001/002/003 que la base real.
 *
 * Uso: npm run test:db   (toma APP_DB_PASSWORD y PGADMIN_USER de .env.local)
 */
const fs = require('fs');
const path = require('path');
const net = require('net');
const { execFileSync, spawnSync, spawn } = require('child_process');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..');
const BIN = '/Applications/Postgres.app/Contents/Versions/18/bin';
const TESTDATA = '/tmp/gestion_estacionamiento_test_pgdata';
const DB = 'gestion_estacionamiento_test';
const results = [];

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('ERROR: falta .env.local (define APP_DB_PASSWORD y PGADMIN_USER).');
    process.exit(1);
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port;
      srv.close(() => resolve(p));
    });
  });
}

async function mustOk(cl, label, sql) {
  try { await cl.query(sql); console.log(`  [OK] ${label}`); return true; }
  catch (e) { console.error(`  [FALLO] ${label}: ${e.message.split('\n')[0]}`); return false; }
}

async function mustFail(cl, label, sql, patterns) {
  try {
    await cl.query(sql);
    console.error(`  [FALLO] ${label}: se esperaba rechazo y NO ocurrió`);
    return false;
  } catch (e) {
    const msg = `${e.code || ''} ${e.message}`;
    if (patterns.some((p) => msg.includes(p))) {
      console.log(`  [OK] ${label} → rechazado: ${msg.split('\n')[0]}`);
      return true;
    }
    console.error(`  [FALLO] ${label}: rechazado pero por causa inesperada → ${msg.split('\n')[0]}`);
    return false;
  }
}

async function scenario(name, fn) {
  console.log(`\n=== ${name} ===`);
  const ok = await fn();
  results.push({ name, ok });
}

async function main() {
  loadEnvLocal();
  const adminUser = process.env.PGADMIN_USER || 'macbook';
  const appPassword = process.env.APP_DB_PASSWORD;
  if (!appPassword) {
    console.error('ERROR: APP_DB_PASSWORD no está definida en .env.local.');
    process.exit(1);
  }
  const port = await freePort();

  // --- Servidor efímero (initdb fresh, sin shared_preload del Postgres.app) ---
  try { execFileSync(`${BIN}/pg_ctl`, ['-D', TESTDATA, 'status'], { stdio: 'ignore' }); }
  catch {
    fs.rmSync(TESTDATA, { recursive: true, force: true });
    execFileSync(`${BIN}/initdb`, ['-D', TESTDATA, '-U', adminUser, '-E', 'UTF8', '--auth=trust'], { stdio: 'ignore' });
  }
  fs.writeFileSync(path.join(TESTDATA, 'postgresql.conf'),
    `port = ${port}\nlisten_addresses = '127.0.0.1'\nunix_socket_directories = '/tmp'\nmax_connections = 30\n`);
  execFileSync(`${BIN}/pg_ctl`, ['-D', TESTDATA, '-l', '/tmp/gestion_test_pg.log',
    '-o', `-p ${port} -k /tmp`, '-w', 'start'], { stdio: 'inherit' });

  // --- Base de test limpia + migraciones (las MISMAS que la base real) ---
  const boot = new Client({ host: '127.0.0.1', port, user: adminUser, database: 'postgres' });
  await boot.connect();
  await boot.query(`DROP DATABASE IF EXISTS ${DB}`);
  await boot.query(`CREATE DATABASE ${DB}`);
  await boot.end();

  for (const f of ['001_initial_schema.sql', '002_seed.sql', '003_roles_permisos.sql']) {
    const r = spawnSync(`${BIN}/psql`, ['-v', 'ON_ERROR_STOP=1',
      '-v', `app_password=${appPassword}`,
      '-h', '127.0.0.1', '-p', String(port), '-U', adminUser, '-d', DB,
      '-f', path.join(ROOT, 'database', 'migrations', f)]);
    if (r.status !== 0) {
      console.error(`ERROR aplicando ${f}:\n${r.stdout.toString()}${r.stderr.toString()}`);
      process.exit(1);
    }
  }

  // --- Conexiones: admin (integridad) y app_estacionamiento (LOGIN REAL) ---
  const c = new Client({ host: '127.0.0.1', port, user: adminUser, database: DB });
  const app = new Client({ host: '127.0.0.1', port, user: 'app_estacionamiento', password: appPassword, database: DB });
  await c.connect();
  await app.connect();

  // T0 — semilla
  await scenario('T0 · semilla: 3 tipos_alquiler, 8 categorias_gasto, configuracion_fiscal id=1', async () => {
    const { rows } = await c.query(`SELECT
        (SELECT count(*) FROM tipos_alquiler)        AS tipos,
        (SELECT count(*) FROM categorias_gasto)      AS categorias,
        (SELECT count(*) FROM configuracion_fiscal)  AS fiscal`);
    if (Number(rows[0].tipos) !== 3) throw new Error(`tipos_alquiler = ${rows[0].tipos}, se esperaba 3`);
    if (Number(rows[0].categorias) !== 8) throw new Error(`categorias_gasto = ${rows[0].categorias}, se esperaba 8`);
    if (Number(rows[0].fiscal) !== 1) throw new Error(`configuracion_fiscal = ${rows[0].fiscal}, se esperaba 1`);
  });

  // T1 — un único movimiento abierto por plaza
  await scenario('T1 · dos movimientos abiertos en la misma plaza → rechazado', async () => {
    const plazaId = (await c.query("INSERT INTO plazas (numero, sector) VALUES ('T1A', 'T') RETURNING id")).rows[0].id;
    await mustOk(c, 'abrir movimiento 1',
      `INSERT INTO movimientos (patente, plaza_id) VALUES ('TEST001', ${plazaId})`);
    await mustFail(c, 'abrir movimiento 2 en la misma plaza (abierto)',
      `INSERT INTO movimientos (patente, plaza_id) VALUES ('TEST002', ${plazaId})`,
      ['uq_movimientos_plaza_abierto']);
    await mustOk(c, 'cerrar movimiento 1',
      `UPDATE movimientos SET hora_salida = now() WHERE patente = 'TEST001'`);
    await mustOk(c, 'abrir movimiento 2 tras cerrar el 1',
      `INSERT INTO movimientos (patente, plaza_id) VALUES ('TEST002', ${plazaId})`);
  });

  // T2 — contratos solapados
  await scenario('T2 · dos contratos activos solapados en la misma plaza → rechazado', async () => {
    const cli = (await c.query("INSERT INTO clientes (nombre) VALUES ('Cliente Test') RETURNING id")).rows[0].id;
    const pla = (await c.query("INSERT INTO plazas (numero, sector) VALUES ('T2A', 'T') RETURNING id")).rows[0].id;
    await mustOk(c, 'crear contrato activo (feb)',
      `INSERT INTO contratos_alquiler (plaza_id, cliente_id, tipo_alquiler_id, fecha_inicio, fecha_fin, monto_total, cuota_mensual, estado)
       VALUES (${pla}, ${cli}, 1, '2026-02-01', '2026-02-28', 100, 100, 'activo')`);
    await mustFail(c, 'crear contrato activo solapado',
      `INSERT INTO contratos_alquiler (plaza_id, cliente_id, tipo_alquiler_id, fecha_inicio, fecha_fin, monto_total, cuota_mensual, estado)
       VALUES (${pla}, ${cli}, 1, '2026-02-15', '2026-03-15', 100, 100, 'activo')`,
      ['exk_contratos_solapados']);
  });

  // T3 — contrato cancelado no bloquea
  await scenario('T3 · contrato cancelado NO bloquea la plaza', async () => {
    const cli = (await c.query("INSERT INTO clientes (nombre) VALUES ('Cliente Test') RETURNING id")).rows[0].id;
    const pla = (await c.query("INSERT INTO plazas (numero, sector) VALUES ('T3A', 'T') RETURNING id")).rows[0].id;
    await mustOk(c, 'crear contrato activo (feb)',
      `INSERT INTO contratos_alquiler (plaza_id, cliente_id, tipo_alquiler_id, fecha_inicio, fecha_fin, monto_total, cuota_mensual, estado)
       VALUES (${pla}, ${cli}, 1, '2026-02-01', '2026-02-28', 100, 100, 'activo')`);
    await mustOk(c, 'crear contrato CANCELADO solapado',
      `INSERT INTO contratos_alquiler (plaza_id, cliente_id, tipo_alquiler_id, fecha_inicio, fecha_fin, monto_total, cuota_mensual, estado)
       VALUES (${pla}, ${cli}, 1, '2026-02-15', '2026-03-15', 100, 100, 'cancelado')`);
  });

  // T4 — coherencia contable del gasto
  await scenario('T4 · gasto con total incoherente → rechazado', async () => {
    await mustOk(c, 'gasto coherente (100 + 21 IVA = 121)',
      `INSERT INTO gastos_compras (fecha, proveedor, cuit_proveedor, tipo_comprobante, neto_gravado, iva_21, total)
       VALUES (CURRENT_DATE, 'Proveedor Test', '20-12345678-9', 'Factura C', 100.00, 21.00, 121.00)`);
    await mustFail(c, 'gasto con total incoherente (declara total 150)',
      `INSERT INTO gastos_compras (fecha, proveedor, cuit_proveedor, tipo_comprobante, neto_gravado, iva_21, total)
       VALUES (CURRENT_DATE, 'Proveedor Test', '20-12345678-9', 'Factura C', 100.00, 21.00, 150.00)`,
      ['gastos_compras_total_check']);
  });

  // T5 — pago duplicado
  await scenario('T5 · pago duplicado (mismo contrato y período) → rechazado', async () => {
    const cli = (await c.query("INSERT INTO clientes (nombre) VALUES ('Cliente Test') RETURNING id")).rows[0].id;
    const pla = (await c.query("INSERT INTO plazas (numero, sector) VALUES ('T5A', 'T') RETURNING id")).rows[0].id;
    const con = (await c.query(`INSERT INTO contratos_alquiler
        (plaza_id, cliente_id, tipo_alquiler_id, fecha_inicio, fecha_fin, monto_total, cuota_mensual, estado)
        VALUES (${pla}, ${cli}, 2, '2026-01-01', '2026-12-31', 1200, 100, 'activo') RETURNING id`)).rows[0].id;
    await mustOk(c, 'registrar pago del período 2026-10-01',
      `INSERT INTO pagos_alquiler (contrato_id, periodo, monto) VALUES (${con}, '2026-10-01', 100)`);
    await mustFail(c, 'registrar el MISMO pago otra vez',
      `INSERT INTO pagos_alquiler (contrato_id, periodo, monto) VALUES (${con}, '2026-10-01', 100)`,
      ['uq_pagos_alquiler_periodo']);
  });

  // T6 — auditoría inmutable
  await scenario('T6 · auditoría inmutable (UPDATE, DELETE y TRUNCATE rechazados)', async () => {
    await mustOk(c, 'insertar registro de auditoría',
      `INSERT INTO auditoria_cambios (accion, tabla, registro_id) VALUES ('INSERT', 'prueba', 1)`);
    await mustFail(c, 'UPDATE sobre auditoria_cambios', `UPDATE auditoria_cambios SET tabla = 'x'`, ['inmutable']);
    await mustFail(c, 'DELETE sobre auditoria_cambios', `DELETE FROM auditoria_cambios`, ['inmutable']);
    await mustFail(c, 'TRUNCATE sobre auditoria_cambios', `TRUNCATE auditoria_cambios`, ['inmutable']);
  });


  // ---------------------------------------------------------------------
  // T7 — Permisos con LOGIN REAL de app_estacionamiento (sin SET ROLE)
  // ---------------------------------------------------------------------
  await scenario('T7 · permisos con LOGIN real de app_estacionamiento', async () => {
    let ok = true;

    // INSERT en gastos_compras usando la secuencia (id automático)
    ok = (await mustOk(app, 'INSERT gastos_compras con id via secuencia',
      `INSERT INTO gastos_compras (fecha, proveedor, neto_gravado, iva_21, total)
       VALUES (CURRENT_DATE, 'Proveedor Test', 100.00, 21.00, 121.00)`)) && ok;

    // INSERT configuracion_fiscal: el permiso existe; id=2 viola el CHECK id=1
    ok = (await mustFail(app, 'INSERT configuracion_fiscal (id=2 → viola CHECK id=1, NO permiso)',
      `INSERT INTO configuracion_fiscal (id, razon_social) VALUES (2, 'X')`,
      ['configuracion_fiscal_id_check'])) && ok;

    // UPDATE ... WHERE id=1 (requiere SELECT para el WHERE + UPDATE)
    ok = (await mustOk(app, 'UPDATE configuracion_fiscal WHERE id=1',
      `UPDATE configuracion_fiscal SET telefono = '+54 11 5555-5555' WHERE id = 1`)) && ok;

    // DELETE en gastos_compras → denegado
    ok = (await mustFail(app, 'DELETE gastos_compras', `DELETE FROM gastos_compras`,
      ['42501', 'permission denied'])) && ok;

    // TRUNCATE en gastos_compras → denegado
    ok = (await mustFail(app, 'TRUNCATE gastos_compras', `TRUNCATE gastos_compras`,
      ['42501', 'permission denied'])) && ok;

    // UPDATE y DELETE en auditoria_cambios → denegados
    ok = (await mustFail(app, 'UPDATE auditoria_cambios',
      `UPDATE auditoria_cambios SET tabla = 'x'`, ['42501', 'permission denied'])) && ok;
    ok = (await mustFail(app, 'DELETE auditoria_cambios',
      `DELETE FROM auditoria_cambios`, ['42501', 'permission denied'])) && ok;

    // SELECT / INSERT / UPDATE en clientes y movimientos
    ok = (await mustOk(app, 'SELECT clientes', `SELECT count(*) FROM clientes`)) && ok;
    ok = (await mustOk(app, 'INSERT clientes',
      `INSERT INTO clientes (nombre) VALUES ('Cliente App') RETURNING id`)) && ok;
    ok = (await mustOk(app, 'UPDATE clientes',
      `UPDATE clientes SET telefono = '555-1234' WHERE nombre = 'Cliente App'`)) && ok;
    const plazaId = (await c.query(
      `INSERT INTO plazas (numero, sector) VALUES ('T7A', 'T') RETURNING id`)).rows[0].id;
    ok = (await mustOk(app, 'INSERT movimientos',
      `INSERT INTO movimientos (patente, plaza_id) VALUES ('APP0001', ${plazaId})`)) && ok;
    ok = (await mustOk(app, 'SELECT movimientos', `SELECT count(*) FROM movimientos`)) && ok;
    ok = (await mustOk(app, 'UPDATE movimientos (cerrar)',
      `UPDATE movimientos SET hora_salida = now() WHERE patente = 'APP0001'`)) && ok;

    return ok;
  });

  // ---------------------------------------------------------------------
  // Cierre
  // ---------------------------------------------------------------------
  await c.end();
  await app.end();
  execFileSync(`${BIN}/pg_ctl`, ['-D', TESTDATA, 'stop', '-m', 'fast'], { stdio: 'ignore' });

  const pasadas = results.filter((r) => r.ok).length;
  console.log(`\nResultado: ${pasadas}/${results.length} escenarios OK`);
  for (const r of results) console.log(`  ${r.ok ? '✔' : '✘'} ${r.name}`);
  process.exit(pasadas === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(`ERROR: ${e.message}`);
  process.exit(1);
});
