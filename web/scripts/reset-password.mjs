#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { chmodSync, writeFileSync, mkdirSync } from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

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

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function generatePassword(length = 20) {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
  let password = "";
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  if (!/[A-Z]/.test(password)) password = password.slice(0, -1) + "A";
  if (!/[a-z]/.test(password)) password = password.slice(0, -1) + "a";
  if (!/[0-9]/.test(password)) password = password.slice(0, -1) + "2";
  if (!/[!@#$%^&*]/.test(password)) password = password.slice(0, -1) + "!";
  return password;
}

function writeCredentialFile(email, password, action) {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const credDir = path.join(homeDir, ".credenciales-estacionamiento");
  const credFile = path.join(credDir, "credenciales-estacionamiento.txt");
  try { mkdirSync(credDir, { recursive: true, mode: 0o700 }); } catch {}
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const entry = `\n[${timestamp}] ${action.toUpperCase()} para ${email}\nContraseña generada: ${password}\n`;
  writeFileSync(credFile, entry, { flag: "a", encoding: "utf8", mode: 0o600 });
  chmodSync(credFile, 0o600);
  return credFile;
}
async function main() {
  loadEnvLocal();

  const modeGenerar = hasFlag("--generar");
  const modeDesbloquear = hasFlag("--desbloquear");
  const modeCrearAdmin = hasFlag("--crear-admin");
  const modeListar = hasFlag("--listar");
  const email = (argValue("--email") ?? "").trim().toLowerCase();
  const nombre = (argValue("--nombre") ?? "").trim();

  // Validar combinaciones permitidas:
  // --listar solo
  // --desbloquear + --email
  // --generar + --email (reset password)
  // --crear-admin + --generar + --email + --nombre
  const esListar = modeListar && !modeGenerar && !modeDesbloquear && !modeCrearAdmin;
  const esDesbloquear = modeDesbloquear && !modeGenerar && !modeCrearAdmin && !modeListar;
  const esReset = modeGenerar && !modeDesbloquear && !modeCrearAdmin && !modeListar;
  const esCrearAdmin = modeCrearAdmin && modeGenerar && !modeDesbloquear && !modeListar;

  if (!esListar && !esDesbloquear && !esReset && !esCrearAdmin) {
    console.error(`
Uso:
  npm run user:reset -- --email X --generar           # Genera nueva contraseña y desbloquea
  npm run user:unlock -- --email X --desbloquear      # Solo desbloquea (reset intentos/bloqueo)
  npm run user:create-admin -- --crear-admin --email X --nombre N --generar  # Crea admin nuevo
  npm run user:list -- --listar                       # Lista usuarios (sin hashes)
`);
    process.exit(1);
  }

  if (esCrearAdmin) {
    if (!email || !nombre) {
      console.error("ERROR: --crear-admin requiere --email, --nombre y --generar");
      process.exit(1);
    }
  } else if (!esListar) {
    if (!email) {
      console.error("ERROR: se requiere --email");
      process.exit(1);
    }
  }

  const pool = new Pool({
    host: process.env.PGHOST ?? "127.0.0.1",
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGADMIN_USER,
    password: process.env.PGADMIN_PASSWORD,
    database: process.env.PGDATABASE,
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (esListar) {
      const { rows } = await client.query(
        `SELECT id, nombre, email, rol, activo, intentos_fallidos, bloqueado_hasta, ultimo_login, creado_en
           FROM usuarios
          WHERE eliminado_en IS NULL
          ORDER BY nombre, id`
      );
      console.table(rows);
      await client.query("COMMIT");
      return;
    }

    if (esCrearAdmin) {
      // Verificar que el email no exista (case-insensitive)
      const { rows: existing } = await client.query(
        `SELECT id FROM usuarios WHERE lower(email) = lower($1) AND eliminado_en IS NULL`,
        [email]
      );
      if (existing.length > 0) {
        console.error(`ERROR: El email ${email} ya está registrado`);
        await client.query("ROLLBACK");
        process.exit(1);
      }

      const password = generatePassword(20);
      const hash = await bcrypt.hash(password, 12);

      const { rows } = await client.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol, activo, intentos_fallidos, bloqueado_hasta)
         VALUES ($1, $2, $3, 'admin', true, 0, NULL)
         RETURNING id, nombre, email, rol, activo`,
        [nombre, email, hash]
      );

      await client.query(
        `INSERT INTO auditoria_cambios (usuario_id, accion, tabla, registro_id, despues, ip)
         VALUES ($1, 'INSERT', 'usuarios', $2, $3::jsonb, NULL)`,
        [rows[0].id, rows[0].id, JSON.stringify({ nombre, email, rol: "admin", activo: true })]
      );

      await client.query("COMMIT");
      const credFile = writeCredentialFile(email, password, "crear admin");
      console.log(`Admin creado:`, rows[0]);
      console.log(`Contraseña guardada en ${credFile} (chmod 600)`);
      return;
    }

    // Buscar usuario
    const { rows: usuarios } = await client.query(
      `SELECT id, nombre, email, rol, activo, intentos_fallidos, bloqueado_hasta, token_version
         FROM usuarios
        WHERE lower(email) = lower($1) AND eliminado_en IS NULL
        FOR UPDATE`,
      [email]
    );

    if (usuarios.length === 0) {
      console.error(`ERROR: No existe usuario con email ${email}`);
      await client.query("ROLLBACK");
      process.exit(1);
    }

    const usuario = usuarios[0];

    if (esDesbloquear) {
      const { rows } = await client.query(
        `UPDATE usuarios
            SET intentos_fallidos = 0,
                bloqueado_hasta = NULL,
                actualizado_en = now()
          WHERE id = $1
          RETURNING id, nombre, email, rol, activo, intentos_fallidos, bloqueado_hasta`,
        [usuario.id]
      );

      await client.query(
        `INSERT INTO auditoria_cambios (usuario_id, accion, tabla, registro_id, antes, despues, ip)
         VALUES ($1, 'UPDATE', 'usuarios', $2, $3::jsonb, $4::jsonb, NULL)`,
        [
          usuario.id,
          usuario.id,
          JSON.stringify({ intentos_fallidos: usuario.intentos_fallidos, bloqueado_hasta: usuario.bloqueado_hasta }),
          JSON.stringify({ intentos_fallidos: 0, bloqueado_hasta: null })
        ]
      );

      await client.query("COMMIT");
      console.log("Cuenta desbloqueada:", rows[0]);
      return;
    }

    if (esReset) {
      const password = generatePassword(20);
      const hash = await bcrypt.hash(password, 12);

      const { rows } = await client.query(
        `UPDATE usuarios
            SET password_hash = $2,
                intentos_fallidos = 0,
                bloqueado_hasta = NULL,
                token_version = token_version + 1,
                actualizado_en = now()
          WHERE id = $1
          RETURNING id, nombre, email, rol, activo, intentos_fallidos, bloqueado_hasta`,
        [usuario.id, hash]
      );

      await client.query(
        `INSERT INTO auditoria_cambios (usuario_id, accion, tabla, registro_id, antes, despues, ip)
         VALUES ($1, 'UPDATE', 'usuarios', $2, $3::jsonb, $4::jsonb, NULL)`,
        [
          usuario.id,
          usuario.id,
          JSON.stringify({ intentos_fallidos: usuario.intentos_fallidos, bloqueado_hasta: usuario.bloqueado_hasta }),
          JSON.stringify({ password_cambiada: true, intentos_fallidos: 0, bloqueado_hasta: null })
        ]
      );

      await client.query("COMMIT");
      const credFile = writeCredentialFile(email, password, "reset password");
      console.log("Contraseña reseteada y cuenta desbloqueada:", rows[0]);
      console.log(`Contraseña guardada en ${credFile} (chmod 600)`);
      return;
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("ERROR:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();