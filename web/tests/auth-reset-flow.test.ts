/**
 * Tests HTTP del flujo de reset por email. Se invocan los handlers REALES:
 *   POST /api/auth/forgot-password  y  POST /api/auth/reset-password
 * contra la base de TEST (se fuerza PGDATABASE y se descarta cualquier pool
 * cacheado de lib/db para que ningún request toque la base real).
 *
 * Cubre: token vencido, token reusado, email inexistente con respuesta
 * idéntica (no enumeración de usuarios) y rate limit por email y por IP.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Pool as PoolType } from "pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import {
  ensureTestDatabase,
  resetearDatosTest,
  assertTestDatabase,
} from "./db-setup.js";
import { POST as forgotPasswordPOST } from "../src/app/api/auth/forgot-password/route";
import { POST as resetPasswordPOST } from "../src/app/api/auth/reset-password/route";

const TEST_DB = "gestion_estacionamiento_test";
const ORIGIN = "http://localhost:3000";
const EMAIL_EXISTENTE = "existente@resetflow.local";
const CLAVE_NUEVA = "ClaveNuevaSegura99";

let pool: PoolType;
let seq = 0;

/** Email único por test: evita colisionar con rate_limit de la hora en curso. */
function emailUnico(prefijo: string): string {
  seq += 1;
  return `${prefijo}-${Date.now()}-${seq}@resetflow.local`;
}

/** IP IPv4 válida (la ruta la castea a ::inet en auditoría) y única por test. */
function ipUnica(): string {
  seq += 1;
  const a = 10 + (Date.now() % 100);
  const b = 20 + (Date.now() % 180);
  return `10.${a}.${b}.${100 + (seq % 150)}`;
}

function request(path: string, body: unknown, ip: string): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      host: "localhost:3000",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

const forgot = (email: string, ip: string) =>
  forgotPasswordPOST(request("/api/auth/forgot-password", { email }, ip));

const reset = (email: string, token: string, ip: string) =>
  resetPasswordPOST(
    request("/api/auth/reset-password", { email, token, newPassword: CLAVE_NUEVA }, ip),
  );

async function crearUsuario(email: string): Promise<number> {
  const hash = await bcrypt.hash("ClaveOriginal123", 12);
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO usuarios (nombre, email, password_hash, rol)
     VALUES ('Reset Flow', $1, $2, 'operador') RETURNING id`,
    [email, hash],
  );
  return rows[0].id;
}

async function insertarToken(
  usuarioId: number,
  token: string,
  expirado: boolean,
): Promise<void> {
  const tokenHash = await bcrypt.hash(token, 10);
  const expira = expirado
    ? `now() - interval '1 minute'`
    : `now() + interval '30 minutes'`;
  await pool.query(
    `INSERT INTO password_reset_tokens (usuario_id, token_hash, expira_en)
     VALUES ($1, $2, ${expira})`,
    [usuarioId, tokenHash],
  );
}

describe("Reset por email (rutas HTTP)", () => {
  beforeAll(async () => {
    await ensureTestDatabase();
    await resetearDatosTest();

    // Las rutas usan lib/db, que arma su Pool con PGDATABASE del entorno y lo
    // cachea en globalThis. Forzamos la base de TEST y descartamos cualquier
    // pool previo para que ningún request de test toque la base real.
    assertTestDatabase(TEST_DB);
    process.env.PGDATABASE = TEST_DB;
    const g = globalThis as typeof globalThis & {
      __gestionEstacionamientoPool?: PoolType;
    };
    if (g.__gestionEstacionamientoPool) {
      await g.__gestionEstacionamientoPool.end().catch(() => undefined);
      g.__gestionEstacionamientoPool = undefined;
    }

    pool = new Pool({
      host: process.env.PGHOST ?? "127.0.0.1",
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.APP_DB_USER ?? "app_estacionamiento",
      password: process.env.APP_DB_PASSWORD,
      database: TEST_DB,
    });

    // Usuario existente para comparar respuestas de forgot-password.
    await crearUsuario(EMAIL_EXISTENTE);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("forgot-password: respuesta idéntica (200 + mismo body) para email inexistente y existente", async () => {
    const resInexistente = await forgot(emailUnico("nadie"), ipUnica());
    const resExistente = await forgot(EMAIL_EXISTENTE, ipUnica());

    expect(resInexistente.status).toBe(200);
    expect(resExistente.status).toBe(200);

    const bodyInexistente = await resInexistente.json();
    const bodyExistente = await resExistente.json();
    expect(bodyInexistente).toEqual(bodyExistente);
    expect(bodyExistente.message).toContain("Si el email existe");
  });

  it("reset-password: token vencido → 400 TOKEN_EXPIRED y no cambia la contraseña", async () => {
    const email = emailUnico("vencido");
    const usuarioId = await crearUsuario(email);
    const token = "a".repeat(64);
    await insertarToken(usuarioId, token, true);

    const res = await reset(email, token, ipUnica());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("TOKEN_EXPIRED");

    const check = await pool.query<{ password_hash: string; usado_en: Date | null }>(
      `SELECT u.password_hash, t.usado_en
         FROM usuarios u
         LEFT JOIN password_reset_tokens t ON t.usuario_id = u.id
        WHERE u.id = $1`,
      [usuarioId],
    );
    expect(await bcrypt.compare("ClaveOriginal123", check.rows[0].password_hash)).toBe(true);
    expect(check.rows[0].usado_en).toBeNull();
  });

  it("reset-password: token reusado → primer uso 200, segundo uso 400 INVALID_TOKEN", async () => {
    const email = emailUnico("reusado");
    const usuarioId = await crearUsuario(email);
    const token = "b".repeat(64);
    await insertarToken(usuarioId, token, false);

    const primera = await reset(email, token, ipUnica());
    expect(primera.status).toBe(200);
    expect((await primera.json()).ok).toBe(true);

    // El token quedó marcado como usado y la contraseña cambió.
    const trasPrimero = await pool.query<{ usado_en: Date | null }>(
      `SELECT usado_en FROM password_reset_tokens WHERE usuario_id = $1`,
      [usuarioId],
    );
    expect(trasPrimero.rows[0].usado_en).not.toBeNull();
    const hash1 = await pool.query<{ password_hash: string }>(
      `SELECT password_hash FROM usuarios WHERE id = $1`,
      [usuarioId],
    );
    expect(await bcrypt.compare(CLAVE_NUEVA, hash1.rows[0].password_hash)).toBe(true);

    // Segundo uso del mismo token: rechazado.
    const segunda = await reset(email, token, ipUnica());
    expect(segunda.status).toBe(400);
    expect((await segunda.json()).code).toBe("INVALID_TOKEN");

    // La contraseña sigue siendo la del primer reset.
    const hash2 = await pool.query<{ password_hash: string }>(
      `SELECT password_hash FROM usuarios WHERE id = $1`,
      [usuarioId],
    );
    expect(await bcrypt.compare(CLAVE_NUEVA, hash2.rows[0].password_hash)).toBe(true);
  });

  it("reset-password: email inexistente responde igual que token inválido (no enumera usuarios)", async () => {
    const resEmailInexistente = await reset(emailUnico("fantasma"), "c".repeat(64), ipUnica());
    expect(resEmailInexistente.status).toBe(400);
    const bodyEmailInexistente = await resEmailInexistente.json();

    const resTokenInvalido = await reset(EMAIL_EXISTENTE, "d".repeat(64), ipUnica());
    expect(resTokenInvalido.status).toBe(400);
    const bodyTokenInvalido = await resTokenInvalido.json();

    expect(bodyEmailInexistente).toEqual(bodyTokenInvalido);
    expect(bodyEmailInexistente.code).toBe("INVALID_TOKEN");
  });

  it("forgot-password: rate limit por email → 429 después de 3 requests en la hora", async () => {
    const email = emailUnico("ratelimit-email");
    for (let i = 0; i < 3; i++) {
      const res = await forgot(email, ipUnica());
      expect(res.status).toBe(200);
    }

    const cuarta = await forgot(email, ipUnica());
    expect(cuarta.status).toBe(429);
    expect((await cuarta.json()).code).toBe("RATE_LIMIT");
  });

  it("forgot-password: rate limit por IP → 429 después de 10 requests en la hora", async () => {
    const ip = ipUnica();
    for (let i = 0; i < 10; i++) {
      const res = await forgot(emailUnico("ratelimit-ip"), ip);
      expect(res.status).toBe(200);
    }

    const onceava = await forgot(emailUnico("ratelimit-ip"), ip);
    expect(onceava.status).toBe(429);
    expect((await onceava.json()).code).toBe("RATE_LIMIT");
  });
});