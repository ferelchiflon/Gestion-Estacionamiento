import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { Client } from "pg";
import { runMigrations, loadEnvLocal } from "../../scripts/migrate.js";

/**
 * Regla decidida: vigencia de contratos con rango semiabierto '[)'.
 * Ver database/migrations/005_contratos_rango_semiabierto.sql y README.md.
 *
 * - fecha_fin es el día en que se libera la plaza (EXCLUSIVO): un contrato
 *   mensual del 01/11 que cubre todo noviembre termina el 01/12.
 * - Un contrato nuevo puede empezar exactamente el día de salida del anterior.
 * - Cancelados y eliminados lógicamente no bloquean.
 * - fecha_fin = fecha_inicio sería un rango vacío => CHECK lo rechaza.
 */
const runDbTests = process.env.RUN_CONTRATOS_DB_TESTS === "1";
const describeDb = runDbTests ? describe : describe.skip;

describeDb("Contratos: rango semiabierto '[)' (exk_contratos_solapados)", () => {
  let pool: Pool;
  let secuencia = 0;
  const TEST_DB = "gestion_estacionamiento_test";

  beforeAll(async () => {
    // Load environment variables
    loadEnvLocal();

    // Recreate test database and apply all migrations
    const adminClient = new Client({
      host: process.env.PGHOST ?? "127.0.0.1",
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.PGADMIN_USER ?? process.env.USER,
      database: "postgres",
    });
    await adminClient.connect();
    await adminClient.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
    await adminClient.query(`CREATE DATABASE ${TEST_DB}`);
    await adminClient.end();

    // Run all migrations
    await runMigrations(TEST_DB);

    pool = new Pool({
      host: process.env.PGHOST ?? "127.0.0.1",
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.APP_DB_USER ?? "app_estacionamiento",
      password: process.env.APP_DB_PASSWORD,
      database: TEST_DB,
    });

    const currentUser = await pool.query<{ usuario: string }>(
      "SELECT current_user AS usuario",
    );
    expect(currentUser.rows[0].usuario).toBe("app_estacionamiento");
  });

  afterAll(async () => {
    await pool?.end();
  });

  async function crearPlaza(): Promise<number> {
    secuencia += 1;
    const plaza = await pool.query<{ id: number }>(
      `INSERT INTO plazas (numero, sector, tipo_vehiculo, estado)
       VALUES ($1, 'C5', 'auto', 'libre')
       RETURNING id`,
      [`C5-${secuencia}`],
    );
    return plaza.rows[0].id;
  }

  async function crearCliente(): Promise<number> {
    secuencia += 1;
    const cliente = await pool.query<{ id: number }>(
      `INSERT INTO clientes (nombre, email)
       VALUES ($1, $2)
       RETURNING id`,
      [`Cliente Contratos ${secuencia}`, `contratos-${secuencia}@test.local`],
    );
    return cliente.rows[0].id;
  }

  async function insertarContrato(datos: {
    plazaId: number;
    clienteId: number;
    fechaInicio: string;
    fechaFin: string;
    estado?: string;
  }): Promise<number> {
    const res = await pool.query<{ id: number }>(
      `INSERT INTO contratos_alquiler
         (plaza_id, cliente_id, tipo_alquiler_id, fecha_inicio, fecha_fin, estado)
       VALUES ($1, $2,
               (SELECT id FROM tipos_alquiler ORDER BY id LIMIT 1),
               $3::date, $4::date, $5)
       RETURNING id`,
      [
        datos.plazaId,
        datos.clienteId,
        datos.fechaInicio,
        datos.fechaFin,
        datos.estado ?? "activo",
      ],
    );
    return res.rows[0].id;
  }

  async function expectPgFail(
    operacion: () => Promise<unknown>,
    codigo: string,
    constraint?: string,
  ): Promise<void> {
    try {
      await operacion();
    } catch (error) {
      const e = error as { code?: string; constraint?: string };
      expect(e.code).toBe(codigo);
      if (constraint) {
        expect(e.constraint).toBe(constraint);
      }
      return;
    }
    throw new Error(`la operación debió fallar con ${codigo}`);
  }

  it("la exclusión usa daterange '[)' y sigue ignorando cancelados y eliminados", async () => {
    const res = await pool.query<{ condef: string }>(
      `SELECT pg_get_constraintdef(oid) AS condef
         FROM pg_constraint
        WHERE conname = 'exk_contratos_solapados'
          AND conrelid = 'contratos_alquiler'::regclass`,
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].condef).toContain("'[)'");
    // pg_get_constraintdev normaliza con casts: (estado)::text <> 'cancelado'::text
    expect(res.rows[0].condef).toContain("<> 'cancelado'");
    expect(res.rows[0].condef).toContain("eliminado_en IS NULL");
  });

  it("acepta B que empieza el mismo día en que A libera la plaza (A: 01/11→30/11, B: 30/11→30/12)", async () => {
    const plazaId = await crearPlaza();
    const clienteId = await crearCliente();

    const idA = await insertarContrato({
      plazaId,
      clienteId,
      fechaInicio: "2026-11-01",
      fechaFin: "2026-11-30",
    });
    expect(idA).toBeGreaterThan(0);

    // A cubre [01/11, 30/11): todo noviembre. El 30/11 la plaza ya está libre.
    const idB = await insertarContrato({
      plazaId,
      clienteId,
      fechaInicio: "2026-11-30",
      fechaFin: "2026-12-30",
    });
    expect(idB).toBeGreaterThan(idA);
  });

  it("rechaza B que empieza el 29/11 mientras A sigue vigente (solapamiento)", async () => {
    const plazaId = await crearPlaza();
    const clienteId = await crearCliente();

    await insertarContrato({
      plazaId,
      clienteId,
      fechaInicio: "2026-11-01",
      fechaFin: "2026-11-30",
    });

    await expectPgFail(
      () =>
        insertarContrato({
          plazaId,
          clienteId,
          fechaInicio: "2026-11-29",
          fechaFin: "2026-12-30",
        }),
      "23P01",
      "exk_contratos_solapados",
    );
  });

  it("un contrato cancelado no bloquea la plaza", async () => {
    const plazaId = await crearPlaza();
    const clienteId = await crearCliente();

    await insertarContrato({
      plazaId,
      clienteId,
      fechaInicio: "2026-11-01",
      fechaFin: "2026-11-30",
    });

    // Cancelado solapado con A: se acepta (los cancelados no bloquean).
    await insertarContrato({
      plazaId,
      clienteId,
      fechaInicio: "2026-11-05",
      fechaFin: "2026-11-20",
      estado: "cancelado",
    });

    // En otra plaza: sobre un contrato cancelado se puede contratar de nuevo.
    const plazaId2 = await crearPlaza();
    await insertarContrato({
      plazaId: plazaId2,
      clienteId,
      fechaInicio: "2026-11-01",
      fechaFin: "2026-11-30",
      estado: "cancelado",
    });
    await insertarContrato({
      plazaId: plazaId2,
      clienteId,
      fechaInicio: "2026-11-05",
      fechaFin: "2026-11-20",
    });
  });

  it("un contrato con borrado lógico no bloquea la plaza", async () => {
    const plazaId = await crearPlaza();
    const clienteId = await crearCliente();

    const idViejo = await insertarContrato({
      plazaId,
      clienteId,
      fechaInicio: "2026-11-01",
      fechaFin: "2026-11-30",
    });
    await pool.query(
      "UPDATE contratos_alquiler SET eliminado_en = now() WHERE id = $1",
      [idViejo],
    );

    await insertarContrato({
      plazaId,
      clienteId,
      fechaInicio: "2026-11-10",
      fechaFin: "2026-12-10",
    });
  });

  it("rechaza fecha_fin igual a fecha_inicio (con '[)' sería un rango vacío)", async () => {
    const plazaId = await crearPlaza();
    const clienteId = await crearCliente();

    await expectPgFail(
      () =>
        insertarContrato({
          plazaId,
          clienteId,
          fechaInicio: "2026-11-01",
          fechaFin: "2026-11-01",
        }),
      "23514",
      "contratos_fechas_check",
    );
  });

  it("rechaza fecha_fin anterior a fecha_inicio", async () => {
    const plazaId = await crearPlaza();
    const clienteId = await crearCliente();

    await expectPgFail(
      () =>
        insertarContrato({
          plazaId,
          clienteId,
          fechaInicio: "2026-11-01",
          fechaFin: "2026-10-31",
        }),
      "23514",
      "contratos_fechas_check",
    );
  });
});
