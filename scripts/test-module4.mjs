#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const TEST_DB = "gestion_estacionamiento_test";

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }

  if (!process.env.APP_DB_PASSWORD) {
    console.error("ERROR: falta APP_DB_PASSWORD en .env.local");
    process.exit(1);
  }
}

function adminConfig(database = "postgres") {
  return {
    host: process.env.PGHOST ?? "127.0.0.1",
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGADMIN_USER ?? process.env.USER,
    database,
  };
}

function appConfig() {
  return {
    host: process.env.PGHOST ?? "127.0.0.1",
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.APP_DB_USER ?? "app_estacionamiento",
    password: process.env.APP_DB_PASSWORD,
    database: TEST_DB,
  };
}

const failures = [];
async function check(name, fn) {
  try {
    await fn();
    console.log(`  [OK] ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  [FALLO] ${name}: ${error.message}`);
  }
}

loadEnvLocal();

// Recrear base de datos de test
const admin = new Client(adminConfig());
await admin.connect();
console.log(`Recreando ${TEST_DB} para pruebas del Módulo 4...`);
await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${TEST_DB}`);
await admin.end();

process.env.PGDATABASE = TEST_DB;
const migrationModule = await import(path.join(root, "scripts", "migrate.js"));
const runMigrations = migrationModule.runMigrations ?? migrationModule.default?.runMigrations;
await runMigrations(TEST_DB);

console.log("\nEjecutando Pruebas de Integración y Concurrencia (Módulo 4):");

// Configurar datos iniciales para las pruebas
const setupClient = new Client(appConfig());
await setupClient.connect();

// 1. Crear plaza de prueba
const pRes = await setupClient.query(
  "INSERT INTO plazas (numero, sector, tipo_vehiculo, estado) VALUES ('T01', 'A', 'auto', 'libre') RETURNING id"
);
const plazaId = pRes.rows[0].id;

// 2. Crear tarifas
await setupClient.query(
  "INSERT INTO tarifas (tipo_vehiculo, tarifa_hora, fecha_desde) VALUES ('auto', 1500.00, '2026-01-01')"
);

// 3. Crear cliente de prueba
const cRes = await setupClient.query(
  "INSERT INTO clientes (nombre, email, saldo_actual) VALUES ('Cliente Test M4', 'm4@test.local', 5000) RETURNING id"
);
const clienteId = cRes.rows[0].id;

await setupClient.end();

// TEST 1: Dos entradas simultáneas a la misma plaza (Promise.all) -> exactamente UNA gana
await check("dos entradas simultáneas a la misma plaza (Promise.all) -> exactamente una gana", async () => {
  async function intentarIngreso(patente) {
    const c = new Client(appConfig());
    await c.connect();
    try {
      await c.query("BEGIN");
      const plaza = await c.query(
        "SELECT id, estado FROM plazas WHERE id = $1 FOR UPDATE",
        [plazaId]
      );
      if (plaza.rows[0].estado !== "libre") {
        await c.query("ROLLBACK");
        return { success: false, reason: "ocupada" };
      }
      await c.query(
        "INSERT INTO movimientos (patente, plaza_id, hora_entrada, estado_pago) VALUES ($1, $2, now(), 'pendiente')",
        [patente, plazaId]
      );
      await c.query("UPDATE plazas SET estado = 'ocupada' WHERE id = $1", [plazaId]);
      await c.query("COMMIT");
      return { success: true };
    } catch (e) {
      await c.query("ROLLBACK");
      return { success: false, reason: e.message };
    } finally {
      await c.end();
    }
  }

  const [res1, res2] = await Promise.all([
    intentarIngreso("CONCUR1"),
    intentarIngreso("CONCUR2"),
  ]);

  const exitos = [res1, res2].filter((r) => r.success).length;
  if (exitos !== 1) {
    throw new Error(`Se esperaba exactamente 1 éxito, pero hubo ${exitos} (res1: ${JSON.stringify(res1)}, res2: ${JSON.stringify(res2)})`);
  }
});

// TEST 2: Doble clic en cobrar -> un solo cobro y un solo recibo
await check("doble clic en cobrar -> un solo cobro y un solo recibo", async () => {
  const c = new Client(appConfig());
  await c.connect();
  const mov = await c.query(
    "SELECT id FROM movimientos WHERE plaza_id = $1 AND hora_salida IS NULL",
    [plazaId]
  );
  const movId = mov.rows[0].id;

  async function intentarCobro() {
    const client = new Client(appConfig());
    await client.connect();
    try {
      await client.query("BEGIN");
      const m = await client.query(
        "SELECT * FROM movimientos WHERE id = $1 FOR UPDATE OF movimientos",
        [movId]
      );
      if (m.rows[0].hora_salida !== null) {
        await client.query("ROLLBACK");
        return { success: false, duplicate: true };
      }

      await client.query(
        "UPDATE movimientos SET hora_salida = now(), monto_calculado = 1500, monto_pagado = 1500, estado_pago = 'pagado' WHERE id = $1",
        [movId]
      );
      await client.query(
        "INSERT INTO recibos (movimiento_id, monto, forma_pago) VALUES ($1, 1500, 'efectivo')",
        [movId]
      );
      await client.query("UPDATE plazas SET estado = 'libre' WHERE id = $1", [plazaId]);
      await client.query("COMMIT");
      return { success: true };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      await client.end();
    }
  }

  const [cobro1, cobro2] = await Promise.all([
    intentarCobro(),
    intentarCobro(),
  ]);

  const exitos = [cobro1, cobro2].filter((c) => c.success).length;
  if (exitos !== 1) {
    throw new Error(`Se esperaba 1 solo cobro, pero hubo ${exitos}`);
  }

  const recibos = await c.query("SELECT count(*)::int as count FROM recibos WHERE movimiento_id = $1", [movId]);
  if (recibos.rows[0].count !== 1) {
    throw new Error(`Se duplicó el recibo: total ${recibos.rows[0].count}`);
  }
  await c.end();
});

// TEST 3: Cálculo de tarifa en casos borde (minuto 0, tolerancia, cambio de día, varios días).
// La lógica vive en TypeScript (web/src/lib/calculo-estadia.ts) y usa el alias
// "@/": node plano no puede resolverlo, así que se ejecuta la suite de vitest
// filtrada al bloque "Regla PHP", que corre contra el código real.
await check("cálculo de tarifa en casos borde (suite vitest: Regla PHP)", async () => {
  const webDir = path.join(root, "web");
  const vitestBin = path.join(webDir, "node_modules", ".bin", "vitest");
  const resultado = spawnSync(
    vitestBin,
    ["run", "tests/modulo4.test.ts", "-t", "Regla PHP"],
    { cwd: webDir, encoding: "utf8" }
  );
  if (resultado.status !== 0) {
    const cola = `${resultado.stdout ?? ""}\n${resultado.stderr ?? ""}`.slice(-1500);
    throw new Error(`vitest terminó con status ${resultado.status}:\n${cola}`);
  }
});

// TEST 4: Salida con deuda
await check("salida con deuda registra pendiente en tabla deudas", async () => {
  const c = new Client(appConfig());
  await c.connect();

  // Abrir nuevo ingreso
  const mRes = await c.query(
    "INSERT INTO movimientos (patente, plaza_id, hora_entrada, estado_pago) VALUES ('DEUDA01', $1, now() - interval '2 hours', 'pendiente') RETURNING id",
    [plazaId]
  );
  const movId = mRes.rows[0].id;
  await c.query("UPDATE plazas SET estado = 'ocupada' WHERE id = $1", [plazaId]);

  // Egreso con deuda
  await c.query("BEGIN");
  await c.query(
    "UPDATE movimientos SET hora_salida = now(), monto_calculado = 3000, monto_pagado = 0, estado_pago = 'deuda' WHERE id = $1",
    [movId]
  );
  await c.query(
    `INSERT INTO deudas (cliente_id, movimiento_id, monto_original, monto_con_interes, fecha_vencimiento, estado)
     VALUES ($1, $2, 3000, 3000, now()::date + 7, 'pendiente')`,
    [clienteId, movId]
  );
  await c.query("UPDATE plazas SET estado = 'libre' WHERE id = $1", [plazaId]);
  await c.query("COMMIT");

  const deuda = await c.query("SELECT * FROM deudas WHERE movimiento_id = $1", [movId]);
  if (deuda.rowCount !== 1 || deuda.rows[0].estado !== "pendiente") {
    throw new Error("No se registró la deuda pendiente para el cliente");
  }
  await c.end();
});

// TEST 5: Permisos por rol en base / lógica
await check("permisos por rol (contador no puede registrar entradas; operador no puede editar tarifas)", async () => {
  const { can } = await import(path.join(root, "web", "src", "lib", "permissions.ts"));

  if (can("contador", "operaciones.write")) {
    throw new Error("El contador no debería tener permiso de operaciones.write");
  }
  if (can("operador", "tarifas.write")) {
    throw new Error("El operador no debería tener permiso de tarifas.write");
  }
  if (!can("admin", "tarifas.write")) {
    throw new Error("El admin debe tener permiso de tarifas.write");
  }
  if (!can("operador", "operaciones.write")) {
    throw new Error("El operador debe tener permiso de operaciones.write");
  }
});

// Destruir base de datos de test
const adminTeardown = new Client(adminConfig());
await adminTeardown.connect();
await adminTeardown.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
await adminTeardown.end();

if (failures.length) {
  console.error(`\nResultado Módulo 4: ${5 - failures.length}/5 pruebas OK`);
  process.exit(1);
}

console.log("\nResultado Módulo 4: 5/5 pruebas OK (Concurrencia, Idempotencia, Tarifas, Deudas, Roles)");
