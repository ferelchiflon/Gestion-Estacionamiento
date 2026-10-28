#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!readEnv(envPath)) {
    console.error("ERROR: falta .env.local en la raíz del proyecto.");
    process.exit(1);
  }
}

function readEnv(filePath) {
  if (!readEnv.cache) readEnv.cache = new Set();
  try {
    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (readEnv.cache.has(key) || process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
      readEnv.cache.add(key);
    }
    return true;
  } catch {
    return false;
  }
}

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

loadEnvLocal();

const email = (argValue("--email") ?? process.env.ADMIN_EMAIL ?? "")
  .trim()
  .toLowerCase();
const password = argValue("--password") ?? process.env.ADMIN_PASSWORD ?? "";
const nombre = argValue("--nombre") ?? "Administrador";
const rol = "admin";

if (!email || !password) {
  console.error(
    "Uso: npm run user:create -- --email admin@ejemplo.local --password 'ClaveSegura123' [--nombre Admin]",
  );
  process.exit(1);
}

if (password.length < 10) {
  console.error("ERROR: la clave debe tener al menos 10 caracteres.");
  process.exit(1);
}

const pool = new Pool({
  host: process.env.PGHOST ?? "127.0.0.1",
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.APP_DB_USER,
  password: process.env.APP_DB_PASSWORD,
  database: process.env.PGDATABASE,
});

try {
  const hash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (lower(email)) DO UPDATE
       SET nombre = EXCLUDED.nombre,
           password_hash = EXCLUDED.password_hash,
           rol = EXCLUDED.rol,
           activo = true,
           eliminado_en = NULL,
           token_version = usuarios.token_version + 1,
           intentos_fallidos = 0,
           bloqueado_hasta = NULL,
           actualizado_en = now()
     RETURNING id, email, rol, activo`,
    [nombre, email, hash, rol],
  );
  console.log("Admin listo:", result.rows[0]);
} catch (error) {
  console.error("ERROR:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
