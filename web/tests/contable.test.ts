import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { ensureTestDatabase, resetearDatosTest } from "./db-setup.js";
import { ivaCompras, ivaVentas, posicionIva } from "../src/lib/contable";

/**
 * Tests del módulo contable de REFERENCIA INTERNA contra PostgreSQL.
 *
 * Se ejecutan solo con RUN_CONTABLE_DB_TESTS=1 (mismo patrón que
 * contratos.test.ts / alquileres-pagos.test.ts) porque recrean la base de test.
 */
const runDbTests = process.env.RUN_CONTABLE_DB_TESTS === "1";
const describeDb = runDbTests ? describe : describe.skip;

/** Período fijo de prueba: marzo 2026 (determinista, en el pasado). */
const DESDE = "2026-03-01";
const HASTA = "2026-03-31";

describeDb("Contable de referencia interna: IVA ventas / compras / posición", () => {
  let pool: Pool;
  let clienteId: number;
  let plazaId: number;
  let contratoId: number;
  const TEST_DB = "gestion_estacionamiento_test";

  async function insertarMovimientoPagado(opts: {
    patente: string;
    fecha: string;
    monto: string;
  }): Promise<number> {
    const res = await pool.query<{ id: number }>(
      `INSERT INTO movimientos
         (patente, plaza_id, hora_entrada, hora_salida, monto_calculado, monto_pagado, estado_pago, forma_pago)
       VALUES ($1, $2, $3::timestamptz, $4::timestamptz, $5::numeric, $5::numeric, 'pagado', 'efectivo')
       RETURNING id`,
      [
        opts.patente,
        plazaId,
        `${opts.fecha} 10:00:00+00`,
        `${opts.fecha} 12:00:00+00`,
        opts.monto,
      ],
    );
    return res.rows[0].id;
  }

  async function insertarReciboMovimiento(opts: {
    movimientoId: number;
    fecha: string;
    monto: string;
  }): Promise<number> {
    const res = await pool.query<{ id: number }>(
      `INSERT INTO recibos (movimiento_id, cliente_id, monto, forma_pago, fecha_emision)
       VALUES ($1, $2, $3::numeric, 'efectivo', $4::timestamptz)
       RETURNING id`,
      [opts.movimientoId, clienteId, opts.monto, `${opts.fecha} 12:00:00+00`],
    );
    return res.rows[0].id;
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

    await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ('Admin Contable', 'contable@test.local', repeat('x', 60), 'admin')`
    );

    const cliente = await pool.query<{ id: number }>(
      `INSERT INTO clientes (nombre, email)
       VALUES ('Cliente Contable', 'cliente-contable@test.local') RETURNING id`
    );
    clienteId = cliente.rows[0].id;

    const plaza = await pool.query<{ id: number }>(
      `INSERT INTO plazas (numero, sector, tipo_vehiculo, estado)
       VALUES ('CT-1', 'C1', 'auto', 'libre') RETURNING id`
    );
    plazaId = plaza.rows[0].id;

    const contrato = await pool.query<{ id: number }>(
      `INSERT INTO contratos_alquiler
         (plaza_id, cliente_id, tipo_alquiler_id, fecha_inicio, fecha_fin,
          monto_total, cuota_mensual, dia_vencimiento, estado)
       VALUES ($1, $2, 2, '2026-03-01', '2026-04-01',
               210.00, 210.00, 10, 'activo')
       RETURNING id`,
      [plazaId, clienteId]
    );
    contratoId = contrato.rows[0].id;

    // ---- Ventas dentro del período (marzo 2026) ----
    // Estacionamiento: $121.00 -> neto $100.00 + IVA $21.00 (alícuota general 21%)
    const movId = await insertarMovimientoPagado({
      patente: "AB123CD",
      fecha: "2026-03-15",
      monto: "121.00",
    });
    await insertarReciboMovimiento({ movimientoId: movId, fecha: "2026-03-15", monto: "121.00" });

    // Alquiler: recibo $210.00 + pago vinculado (recibo_id NOT NULL, migración 009)
    const reciboAlq = await pool.query<{ id: number }>(
      `INSERT INTO recibos (contrato_id, cliente_id, monto, forma_pago, fecha_emision)
       VALUES ($1, $2, 210.00, 'transferencia', '2026-03-20 12:00:00+00')
       RETURNING id`,
      [contratoId, clienteId]
    );
    await pool.query(
      `INSERT INTO pagos_alquiler (contrato_id, periodo, monto, fecha_pago, recibo_id, estado)
       VALUES ($1, '2026-03', 210.00, '2026-03-20 12:00:00+00', $2, 'pagado')`,
      [contratoId, reciboAlq.rows[0].id]
    );

    // ---- Venta fuera del período (abril 2026): debe excluirse ----
    const movFuera = await insertarMovimientoPagado({
      patente: "ZZ999ZZ",
      fecha: "2026-04-15",
      monto: "242.00",
    });
    await insertarReciboMovimiento({
      movimientoId: movFuera,
      fecha: "2026-04-15",
      monto: "242.00",
    });

    // ---- Compras dentro del período (marzo 2026) ----
    await pool.query(
      `INSERT INTO gastos_compras
         (fecha, proveedor, cuit_proveedor, tipo_comprobante, neto_gravado, iva_21, iva_105, iva_27,
          no_gravado, percepcion_iva, percepcion_iibb, total)
       VALUES ('2026-03-10', 'Proveedor Uno', '20123456789', 'Factura A',
               100.00, 21.00, 0, 0, 0, 0, 0, 121.00)`
    );
    await pool.query(
      `INSERT INTO gastos_compras
         (fecha, proveedor, cuit_proveedor, tipo_comprobante, neto_gravado, iva_21, iva_105, iva_27,
          no_gravado, percepcion_iva, percepcion_iibb, total)
       VALUES ('2026-03-11', 'Proveedor Dos', '20876543219', 'Factura B',
               200.00, 0, 21.00, 0, 0, 0, 0, 221.00)`
    );
    // Compra fuera del período (febrero 2026) con IVA 27: debe excluirse de marzo
    await pool.query(
      `INSERT INTO gastos_compras
         (fecha, proveedor, cuit_proveedor, tipo_comprobante, neto_gravado, iva_21, iva_105, iva_27,
          no_gravado, percepcion_iva, percepcion_iibb, total)
       VALUES ('2026-02-20', 'Proveedor Fuera', '20111111119', 'Factura A',
               100.00, 0, 0, 27.00, 0, 0, 0, 127.00)`
    );
  });

  afterAll(async () => {
    await pool?.end();
  });


  it("migración 009: pagos_alquiler exige recibo_id NOT NULL", async () => {
    await expect(
      pool.query(
        `INSERT INTO pagos_alquiler (contrato_id, periodo, monto, fecha_pago, estado)
         VALUES ($1, '2026-04', 210.00, now(), 'pagado')`,
        [contratoId]
      )
    ).rejects.toThrow(/recibo_id/i);
  });

  it("ivaVentas discrimina neto e IVA de las operaciones del período", async () => {
    const reporte = await ivaVentas(pool, { desde: DESDE, hasta: HASTA });

    expect(reporte.operaciones).toHaveLength(2);
    expect(reporte.discrimina_alicuota_por_operacion).toBe(false);
    expect(reporte.alicuota_general).toBe("21.00");

    const estacionamiento = reporte.operaciones.find((o) => o.tipo === "movimiento");
    const alquiler = reporte.operaciones.find((o) => o.tipo === "alquiler");

    expect(estacionamiento?.monto_total).toBe("121.00");
    expect(estacionamiento?.neto).toBe("100.00");
    expect(estacionamiento?.iva).toBe("21.00");

    // $210.00 con 21%: neto $173.55 + IVA $36.45 (desglose exacto en centavos)
    expect(alquiler?.monto_total).toBe("210.00");
    expect(alquiler?.neto).toBe("173.55");
    expect(alquiler?.iva).toBe("36.45");

    expect(reporte.totales.operaciones).toBe(2);
    expect(reporte.totales.neto).toBe("273.55");
    expect(reporte.totales.iva).toBe("57.45");
    expect(reporte.totales.total).toBe("331.00");

    expect(reporte.totales_por_alicuota).toEqual([
      { alicuota: "21.00", operaciones: 2, neto: "273.55", iva: "57.45", total: "331.00" },
    ]);

    expect(reporte.advertencias.join(" ")).toMatch(/aprobación del contador/);
    expect(reporte.advertencias.join(" ")).toMatch(/no discrimina la alícuota/);
  });


  it("los filtros desde/hasta excluyen lo que queda fuera del rango", async () => {
    const soloMarzo = await ivaVentas(pool, { desde: "2026-03-01", hasta: "2026-03-31" });
    expect(soloMarzo.operaciones).toHaveLength(2);
    expect(soloMarzo.totales.total).toBe("331.00");

    const mitadDeMarzo = await ivaVentas(pool, { desde: "2026-03-01", hasta: "2026-03-15" });
    expect(mitadDeMarzo.operaciones).toHaveLength(1);
    expect(mitadDeMarzo.operaciones[0].tipo).toBe("movimiento");

    const abril = await ivaVentas(pool, { desde: "2026-04-01", hasta: "2026-04-30" });
    expect(abril.operaciones).toHaveLength(1);
    expect(abril.operaciones[0].monto_total).toBe("242.00");

    const comprasMarzo = await ivaCompras(pool, { desde: "2026-03-01", hasta: "2026-03-31" });
    expect(comprasMarzo.comprobantes).toHaveLength(2);
    expect(comprasMarzo.totales.iva).toBe("42.00");

    const comprasFebrero = await ivaCompras(pool, { desde: "2026-02-01", hasta: "2026-02-28" });
    expect(comprasFebrero.comprobantes).toHaveLength(1);
    expect(comprasFebrero.comprobantes[0].proveedor).toBe("Proveedor Fuera");
    expect(comprasFebrero.comprobantes[0].iva_27).toBe("27.00");
  });

  it("ivaCompras suma el IVA cargado por alícuota (21 / 10,5 / 27)", async () => {
    const reporte = await ivaCompras(pool, { desde: DESDE, hasta: HASTA });

    expect(reporte.comprobantes).toHaveLength(2);
    expect(reporte.totales.comprobantes).toBe(2);
    expect(reporte.totales.neto_gravado).toBe("300.00");
    expect(reporte.totales.iva).toBe("42.00");
    expect(reporte.totales.total).toBe("342.00");

    const porAlicuota = Object.fromEntries(
      reporte.totales_por_alicuota.map((f) => [f.alicuota, f])
    );
    expect(porAlicuota["21.00"].iva).toBe("21.00");
    expect(porAlicuota["21.00"].comprobantes).toBe(1);
    expect(porAlicuota["10.50"].iva).toBe("21.00");
    expect(porAlicuota["10.50"].comprobantes).toBe(1);
    expect(porAlicuota["27.00"].iva).toBe("0.00");
    expect(reporte.advertencias.join(" ")).toMatch(/aprobación del contador/);
  });

  it("posicionIva: saldo = IVA ventas - IVA compras por alícuota (referencia)", async () => {
    const reporte = await posicionIva(pool, { desde: DESDE, hasta: HASTA });

    const porAlicuota = Object.fromEntries(reporte.filas.map((f) => [f.alicuota, f]));

    // 21%: ventas 57.45 - compras 21.00 = 36.45 a pagar
    expect(porAlicuota["21.00"].iva_ventas).toBe("57.45");
    expect(porAlicuota["21.00"].iva_compras).toBe("21.00");
    expect(porAlicuota["21.00"].saldo).toBe("36.45");
    expect(porAlicuota["21.00"].estado).toBe("a_pagar");

    // 10,5%: ventas 0 - compras 21.00 = -21.00 a favor
    expect(porAlicuota["10.50"].saldo).toBe("-21.00");
    expect(porAlicuota["10.50"].estado).toBe("a_favor");

    // Sin percepciones: saldo total = 36.45 - 21.00 = 15.45 a pagar
    expect(reporte.percepciones_iva).toBe("0.00");
    expect(reporte.saldo_total).toBe("15.45");
    expect(reporte.estado_total).toBe("a_pagar");

    // Invariantes: saldo por alícuota = ventas - compras; total = suma - percepciones
    for (const fila of reporte.filas) {
      const ventas = Number(fila.iva_ventas);
      const compras = Number(fila.iva_compras);
      expect(Number(fila.saldo)).toBeCloseTo(ventas - compras, 2);
    }
    const sumaSaldos = reporte.filas.reduce((acc, f) => acc + Number(f.saldo), 0);
    expect(Number(reporte.saldo_total)).toBeCloseTo(
      sumaSaldos - Number(reporte.percepciones_iva),
      2
    );
    expect(reporte.advertencias.join(" ")).toMatch(/referencia interna/);
  });
});

