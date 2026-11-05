import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { ensureTestDatabase, resetearDatosTest } from "./db-setup.js";
import {
  registrarPago,
  listPagos,
  getTiposAlquiler,
  getPagosPendientes,
} from "../src/lib/alquiler";

/**
 * Tests de pagos de alquiler contra PostgreSQL.
 *
 * Se ejecutan solo con RUN_ALQUILERES_DB_TESTS=1 (mismo patrón que
 * contratos.test.ts / modulo4.test.ts) porque recrean la base de test.
 */
const runDbTests = process.env.RUN_ALQUILERES_DB_TESTS === "1";
const describeDb = runDbTests ? describe : describe.skip;

describeDb("Pagos de alquiler: pago + recibo + listado", () => {
  let pool: Pool;
  let usuarioId: number;
  let clienteId: number;
  let contratoId: number;
  const TEST_DB = "gestion_estacionamiento_test";

  /** Período que la app considera vigente (mes actual en zona AR). */
  async function periodoActual(): Promise<string> {
    const res = await pool.query<{ periodo: string }>(
      `SELECT to_char((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM') as periodo`
    );
    return res.rows[0].periodo;
  }

  beforeAll(async () => {


    // Setup compartido: garantiza base de test al dia (idempotente)
    await ensureTestDatabase();
    await resetearDatosTest();

    pool = new Pool({
      host: process.env.PGHOST ?? "127.0.0.1",
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.APP_DB_USER ?? "app_estacionamiento",
      password: process.env.APP_DB_PASSWORD,
      database: TEST_DB,
    });

    const usuario = await pool.query<{ id: number }>(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ('Admin Pagos', 'pagos@test.local', repeat('x', 60), 'admin')
       RETURNING id`
    );
    usuarioId = usuario.rows[0].id;

    const plaza = await pool.query<{ id: number }>(
      `INSERT INTO plazas (numero, sector, tipo_vehiculo, estado)
       VALUES ('PA-1', 'P1', 'auto', 'libre') RETURNING id`
    );
    const cliente = await pool.query<{ id: number }>(
      `INSERT INTO clientes (nombre, email)
       VALUES ('Cliente Pagos', 'cliente-pagos@test.local') RETURNING id`
    );
    clienteId = cliente.rows[0].id;
    const contrato = await pool.query<{ id: number }>(
      `INSERT INTO contratos_alquiler
         (plaza_id, cliente_id, tipo_alquiler_id, fecha_inicio, fecha_fin,
          monto_total, cuota_mensual, dia_vencimiento, estado)
       VALUES ($1, $2, 2, CURRENT_DATE, CURRENT_DATE + interval '1 month',
               100000.00, 100000.00, 10, 'activo')
       RETURNING id`,
      [plaza.rows[0].id, cliente.rows[0].id]
    );
    contratoId = contrato.rows[0].id;
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("getTiposAlquiler devuelve los tipos sembrados", async () => {
    const tipos = await getTiposAlquiler(pool);
    expect(tipos.map((t) => t.nombre)).toEqual(["Diario", "Mensual", "Anual"]);
  });

  it("registrarPago crea el pago y el recibo, y los vincula por recibo_id", async () => {
    const resultado = await registrarPago(
      pool,
      {
        contrato_id: contratoId,
        periodo: await periodoActual(),
        monto: "1000.00",
        forma_pago: "efectivo",
      },
      { usuarioId, ip: "127.0.0.1" }
    );

    expect(resultado.pago.monto).toBe("1000.00");
    expect(resultado.recibo.monto).toBe("1000.00");
    expect(resultado.recibo.contrato_id).toBe(contratoId);
    expect(resultado.pago.recibo_id).toBe(resultado.recibo.id);

    const historial = await listPagos(pool);
    const fila = historial.find((p) => p.id === resultado.pago.id);

    expect(fila).toBeDefined();
    expect(fila?.recibo_id).toBe(resultado.recibo.id);
    expect(fila?.recibo_numero).toBe(resultado.recibo.numero);
    expect(fila?.forma_pago).toBe("efectivo");
    expect(fila?.cliente_nombre).toBe("Cliente Pagos");
    expect(fila?.plaza_numero).toBe("PA-1");
  });

  it("rechaza un segundo pago del mismo contrato y período", async () => {
    await expect(
      registrarPago(
        pool,
        {
          contrato_id: contratoId,
          periodo: await periodoActual(),
          monto: "1000.00",
          forma_pago: "efectivo",
        },
        { usuarioId }
      )
    ).rejects.toMatchObject({ status: 409, code: "PAGO_YA_REGISTRADO" });
  });

  it("el contrato pagado deja de figurar como pendiente y el impago sigue listado", async () => {
    const pendientes = await getPagosPendientes(pool);

    // Contrato con el período actual pagado: no debe volver a listarse.
    expect(pendientes.find((p) => p.contrato_id === contratoId)).toBeUndefined();

    // Segundo contrato mensual sin pagar: debe listarse con su cuota y vencimiento.
    const plaza2 = await pool.query<{ id: number }>(
      `INSERT INTO plazas (numero, sector, tipo_vehiculo, estado)
       VALUES ('PA-2', 'P1', 'auto', 'libre') RETURNING id`
    );
    const contrato2 = await pool.query<{ id: number }>(
      `INSERT INTO contratos_alquiler
         (plaza_id, cliente_id, tipo_alquiler_id, fecha_inicio, fecha_fin,
          monto_total, cuota_mensual, dia_vencimiento, estado)
       VALUES ($1, $2, 2, CURRENT_DATE, CURRENT_DATE + interval '1 month',
               50000.00, 50000.00, 15, 'activo')
       RETURNING id`,
      [plaza2.rows[0].id, clienteId]
    );

    const pendientesFinales = await getPagosPendientes(pool);
    const pendiente = pendientesFinales.find(
      (p) => p.contrato_id === contrato2.rows[0].id
    );

    expect(pendiente).toBeDefined();
    expect(pendiente?.cuota_mensual).toBe("50000.00");
    expect(pendiente?.dia_vencimiento).toBe(15);
    expect(pendiente?.periodo).toBe(await periodoActual());
  });
});
