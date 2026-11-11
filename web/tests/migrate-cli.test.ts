/**
 * Tests del CLI de migraciones (scripts/migrate.js), invocado con spawn:
 * - Sin --confirmar-real, la base REAL sigue bloqueada (guarda por defecto).
 * - Con --confirmar-real y sin backup reciente (<24 h y >10 KB), aborta.
 * - Con backup válido y sin --aplicar: SIMULA — imprime pendientes con
 *   checksum y NO modifica nada (ni siquiera crea schema_migrations).
 * - El flujo normal sigue funcionando: aplica sobre una base _test vacía.
 *
 * Todos los casos usan bases que terminan en "_test" y directorios de backup
 * temporales ($MIGRATE_BACKUPS_DIR): jamás tocan ~/backups ni la base real
 * (los casos "bloqueado"/"aborta" cortan ANTES de conectarse a la base).
 */

import { afterAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const WEB_TESTS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(WEB_TESTS, "..", "..");
const MIGRATE = path.join(ROOT, "scripts", "migrate.js");
const DB_REAL = "gestion_estacionamiento";
const DB_CLI = "gestion_estacionamiento_cli_test";

const backupsDir = mkdtempSync(path.join(tmpdir(), "migrate-backups-"));

function correrCli(
  args: string[],
  envExtra: Record<string, string> = {},
): { code: number; stdout: string } {
  try {
    const stdout = execFileSync("node", [MIGRATE, ...args], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, ...envExtra },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
    });
    return { code: 0, stdout: String(stdout) };
  } catch (err) {
    const e = err as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer };
    return { code: e.status ?? 1, stdout: `${String(e.stdout ?? "")}${String(e.stderr ?? "")}` };
  }
}

async function conAdmin(database: string): Promise<Client> {
  const c = new Client({
    host: process.env.PGHOST ?? "127.0.0.1",
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGADMIN_USER ?? process.env.USER,
    database,
  });
  await c.connect();
  return c;
}

async function recrearBaseVacia(db: string): Promise<void> {
  const admin = await conAdmin("postgres");
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${db}`);
  } finally {
    await admin.end();
  }
}

describe("migrate.js CLI (bases _test; nunca toca la real)", () => {
  afterAll(async () => {
    rmSync(backupsDir, { recursive: true, force: true });
    const admin = await conAdmin("postgres");
    try {
      await admin.query(`DROP DATABASE IF EXISTS ${DB_CLI} WITH (FORCE)`);
    } finally {
      await admin.end();
    }
  });

  it("sin --confirmar-real, la base REAL sigue bloqueada", () => {
    const r = correrCli(["--database", DB_REAL]);
    expect(r.code).not.toBe(0);
    expect(r.stdout).toMatch(/SEGURIDAD/);
    expect(r.stdout).toMatch(/confirmar-real/);
  }, 30_000);

  it("con --confirmar-real y sin backup reciente, aborta", () => {
    const vacio = mkdtempSync(path.join(tmpdir(), "migrate-vacio-"));
    try {
      const r = correrCli(["--confirmar-real", "--database", DB_REAL], {
        MIGRATE_BACKUPS_DIR: vacio,
      });
      expect(r.code).not.toBe(0);
      expect(r.stdout).toMatch(/backup/i);
    } finally {
      rmSync(vacio, { recursive: true, force: true });
    }
  }, 30_000);

  it("backups viejos (>24 h) o chicos (<10 KB) no cuentan", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "migrate-mixto-"));
    try {
      const viejo = path.join(dir, "viejo.sql");
      writeFileSync(viejo, "x".repeat(20 * 1024));
      const haceDosDias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      utimesSync(viejo, haceDosDias, haceDosDias);
      writeFileSync(path.join(dir, "chico.sql"), "x".repeat(1024)); // < 10 KB

      const r = correrCli(["--confirmar-real", "--database", DB_REAL], {
        MIGRATE_BACKUPS_DIR: dir,
      });
      expect(r.code).not.toBe(0);
      expect(r.stdout).toMatch(/backup/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  it("con backup válido y sin --aplicar: SIMULA, lista pendientes y no modifica nada", async () => {
    writeFileSync(path.join(backupsDir, "fresco.sql"), "x".repeat(20 * 1024));
    await recrearBaseVacia(DB_CLI);

    const r = correrCli(["--confirmar-real", "--database", DB_CLI], {
      MIGRATE_BACKUPS_DIR: backupsDir,
    });
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/Backup OK/);
    expect(r.stdout).toMatch(/SIMULACI/);
    expect(r.stdout).toMatch(/Migraciones pendientes: 12/);
    expect(r.stdout).toMatch(/001_initial_schema/);
    expect(r.stdout).toMatch(/012_password_reset_tokens/);
    expect(r.stdout).toMatch(/sha256 [0-9a-f]{64}/);

    // (c) simulación: no se creó schema_migrations ni se registró nada
    const c = await conAdmin(DB_CLI);
    try {
      const { rows } = await c.query<{ t: string | null }>(
        `SELECT to_regclass('public.schema_migrations') AS t`,
      );
      expect(rows[0].t).toBeNull();
    } finally {
      await c.end();
    }
  }, 60_000);

  it("flujo normal: aplica migraciones pendientes sobre base _test vacía", async () => {
    await recrearBaseVacia(DB_CLI);

    const r = correrCli(["--database", DB_CLI]);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/Migraciones nuevas aplicadas: 12/);

    const c = await conAdmin(DB_CLI);
    try {
      const { rows } = await c.query<{ version: string; checksum: string }>(
        `SELECT version, checksum FROM schema_migrations ORDER BY version`,
      );
      expect(rows).toHaveLength(12);

      // El checksum registrado coincide con el sha256 del archivo (no se
      // alteró nada respecto de lo ya aplicado en las otras bases).
      const sql12 = readFileSync(
        path.join(ROOT, "database", "migrations", "012_password_reset_tokens.sql"),
        "utf8",
      );
      const esperado = createHash("sha256").update(sql12, "utf8").digest("hex");
      const fila12 = rows.find((f) => f.version === "012_password_reset_tokens");
      expect(fila12?.checksum).toBe(esperado);
    } finally {
      await c.end();
    }
  }, 60_000);
});