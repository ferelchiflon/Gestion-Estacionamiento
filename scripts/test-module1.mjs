#!/usr/bin/env node
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

async function expectPgError(fn, expectedCode, expectedMessage) {
  try {
    await fn();
  } catch (error) {
    const code = error.code;
    if (code !== expectedCode) {
      throw new Error(`esperaba ${expectedCode}, obtuvo ${code}: ${error.message}`);
    }
    if (expectedMessage && !error.message.includes(expectedMessage)) {
      throw new Error(`mensaje inesperado: ${error.message}`);
    }
    return;
  }
  throw new Error(`la operación debió fallar con ${expectedCode}`);
}

loadEnvLocal();

const admin = new Client(adminConfig());
await admin.connect();

console.log(`Recreando ${TEST_DB}...`);
await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${TEST_DB}`);
await admin.end();

process.env.PGDATABASE = TEST_DB;
const migrationModule = await import(path.join(root, "scripts", "migrate.js"));
const runMigrations =
  migrationModule.runMigrations ?? migrationModule.default?.runMigrations;
if (typeof runMigrations !== "function") {
  console.error("ERROR: no se pudo importar runMigrations");
  process.exit(1);
}
await runMigrations(TEST_DB);

const app = new Client(appConfig());
await app.connect();

console.log("\nPruebas módulo 1 con rol app_estacionamiento:");
await check("conecta como app_estacionamiento", async () => {
  const { rows } = await app.query("SELECT current_user AS usuario");
  if (rows[0].usuario !== "app_estacionamiento") {
    throw new Error(`usuario inesperado: ${rows[0].usuario}`);
  }
});

await check("email es único sin distinguir mayúsculas", async () => {
  await app.query(
    `INSERT INTO usuarios (nombre,email,password_hash,rol)
     VALUES ('Admin Test','admin@test.local',repeat('x',60),'admin')`,
  );
  await expectPgError(
    () =>
      app.query(
        `INSERT INTO usuarios (nombre,email,password_hash,rol)
         VALUES ('Duplicado','ADMIN@TEST.LOCAL',repeat('x',60),'operador')`,
      ),
    "23505",
    "uq_usuarios_email",
  );
});

await check("rol inválido es rechazado por CHECK", async () => {
  await expectPgError(
    () =>
      app.query(
        `INSERT INTO usuarios (nombre,email,password_hash,rol)
         VALUES ('Invalido','invalido@test.local',repeat('x',60),'supervisor')`,
      ),
    "23514",
    "usuarios_rol_check",
  );
});

await check("app puede actualizar usuario (soft delete incluido)", async () => {
  const updated = await app.query(
    `UPDATE usuarios
        SET activo = false,
            token_version = token_version + 1,
            actualizado_en = now()
      WHERE email = 'admin@test.local'
      RETURNING activo, token_version, eliminado_en`,
  );
  if (updated.rows[0].activo !== false || updated.rows[0].token_version !== 2) {
    throw new Error("el update no produjo el estado esperado");
  }
  await app.query(
    `UPDATE usuarios SET activo=true, token_version=token_version+1
      WHERE email='admin@test.local'`,
  );
});

await check("app no puede DELETE físico en usuarios", async () => {
  await expectPgError(
    () => app.query("DELETE FROM usuarios WHERE email='admin@test.local'"),
    "42501",
    "permission denied",
  );
});

await check("auditoría acepta INSERT del rol app", async () => {
  const usuario = await app.query(
    "SELECT id FROM usuarios WHERE email='admin@test.local'",
  );
  const audit = await app.query(
    `INSERT INTO auditoria_cambios
       (usuario_id,accion,tabla,registro_id,antes,despues)
     VALUES ($1,'UPDATE','usuarios',$2,'{}'::jsonb,'{"test":true}'::jsonb)
     RETURNING id`,
    [usuario.rows[0].id, usuario.rows[0].id],
  );
  if (!audit.rows[0].id) throw new Error("no insertó auditoría");
});

await check("auditoría no puede modificarse ni borrarse", async () => {
  await expectPgError(
    () => app.query("UPDATE auditoria_cambios SET tabla='x'"),
    "42501",
    "permission denied",
  );
  await expectPgError(
    () => app.query("DELETE FROM auditoria_cambios"),
    "42501",
    "permission denied",
  );
});

await check("borrado lógico excluye al usuario", async () => {
  await app.query(
    `UPDATE usuarios
        SET eliminado_en=now(), activo=false, token_version=token_version+1
      WHERE email='admin@test.local'`,
  );
  const { rows } = await app.query(
    `SELECT count(*)::int total FROM usuarios
      WHERE email='admin@test.local' AND eliminado_en IS NULL`,
  );
  if (rows[0].total !== 0) {
    throw new Error("el usuario sigue visible tras borrado lógico");
  }
});

await app.end();

if (failures.length) {

  console.error(`\nResultado: ${8 - failures.length}/8 pruebas OK`);
  process.exit(1);
}

console.log("\nResultado: 8/8 pruebas OK");
