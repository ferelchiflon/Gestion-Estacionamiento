import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import {
  calcularHorasFacturables,
  calcularMontoEstadia,
} from "../src/lib/calculo-estadia";
import {
  ingresoSchema,
  egresoCobroSchema,
} from "../src/lib/validations/modulo4";
import {
  centavosAPesosTexto,
  pesosTextoACentavos,
} from "../src/lib/dinero";
import { can } from "../src/lib/permissions";
import {
  registrarEgreso,
  registrarIngreso,
} from "../src/lib/movimientos";

describe("Cálculo de Tarifas y Estadías (Regla PHP)", () => {
  it("minuto 0 o menos de una hora factura 1 hora mínima", () => {
    const entrada = new Date("2026-10-21T10:00:00Z");
    const salida0m = new Date("2026-10-21T10:00:00Z");
    const salida15m = new Date("2026-10-21T10:15:00Z");

    const res0 = calcularHorasFacturables(entrada, salida0m);
    expect(res0.minutosTotales).toBe(0);
    expect(res0.horasCobrables).toBe(1);

    const res15 = calcularHorasFacturables(entrada, salida15m);
    expect(res15.minutosTotales).toBe(15);
    expect(res15.horasCobrables).toBe(1);
  });

  it("1 hora exacta factura 1 hora", () => {
    const entrada = new Date("2026-10-21T10:00:00Z");
    const salida60m = new Date("2026-10-21T11:00:00Z");

    const res = calcularHorasFacturables(entrada, salida60m);
    expect(res.minutosTotales).toBe(60);
    expect(res.horasCobrables).toBe(1);
  });

  it("1 hora y 1 minuto redondea hacia arriba a 2 horas (ceil)", () => {
    const entrada = new Date("2026-10-21T10:00:00Z");
    const salida61m = new Date("2026-10-21T11:01:00Z");

    const res = calcularHorasFacturables(entrada, salida61m);
    expect(res.minutosTotales).toBe(61);
    expect(res.horasCobrables).toBe(2);
  });

  it("ignora los segundos como PHP: 1h00m01s todavía cobra 1 hora", () => {
    const entrada = new Date("2026-10-21T10:00:00Z");
    const salida = new Date("2026-10-21T11:00:01Z");

    const res = calcularHorasFacturables(entrada, salida);
    expect(res.minutosTotales).toBe(60);
    expect(res.horasCobrables).toBe(1);
  });

  it("estadía de varios días calcula correctamente", () => {
    const entrada = new Date("2026-10-21T10:00:00Z");
    const salida2Dias = new Date("2026-10-23T12:30:00Z"); // 50 horas y 30 min -> 51 horas

    const res = calcularHorasFacturables(entrada, salida2Dias);
    expect(res.horasCobrables).toBe(51);
  });

  it("calcula montos en centavos sin floats", () => {
    const entrada = new Date("2026-10-21T10:00:00Z");
    const salida = new Date("2026-10-21T12:05:00Z"); // 3 horas
    const tarifaCentavos = 150050; // $1.500,50

    const calc = calcularMontoEstadia(entrada, salida, tarifaCentavos);
    expect(calc.horasCobrables).toBe(3);
    expect(calc.montoTotalCentavos).toBe(450150); // Exacto
    expect(calc.montoTotalPesos).toBe("4501.50");
  });

  it("convierte PostgreSQL numeric a centavos sin punto flotante", () => {
    expect(pesosTextoACentavos("1500.50")).toBe(150050);
    expect(pesosTextoACentavos("0.01")).toBe(1);
    expect(centavosAPesosTexto(150050)).toBe("1500.50");
    expect(centavosAPesosTexto(0)).toBe("0.00");
  });
});

describe("Validaciones de Movimientos", () => {
  it("valida y normaliza ingreso", () => {
    const res = ingresoSchema.safeParse({
      patente: " aa 123 - bb ",
      plaza_id: 5,
      tipo_vehiculo: "auto",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.patente).toBe("AA123BB");
    }
  });

  it("rechaza ingreso sin plaza", () => {
    const res = ingresoSchema.safeParse({
      patente: "AA123BB",
    });
    expect(res.success).toBe(false);
  });

  it("valida payload de egreso y descarta un monto enviado por el cliente", () => {
    const res = egresoCobroSchema.safeParse({
      movimiento_id: 10,
      forma_pago: "tarjeta",
      registrar_como_deuda: false,
      monto: "999999.99",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).not.toHaveProperty("monto");
    }
  });

  it("restringe la escritura de operaciones a admin y operador", () => {
    expect(can("admin", "operaciones.write")).toBe(true);
    expect(can("operador", "operaciones.write")).toBe(true);
    expect(can("contador", "operaciones.write")).toBe(false);
  });
});

const runDbTests = process.env.RUN_MODULE4_DB_TESTS === "1";
const describeDb = runDbTests ? describe : describe.skip;

describeDb("Módulo 4 contra PostgreSQL", () => {
  let pool: Pool;
  let usuarioId: number;
  let secuencia = 0;

  beforeAll(async () => {
    pool = new Pool({
      host: process.env.PGHOST ?? "127.0.0.1",
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.APP_DB_USER ?? "app_estacionamiento",
      password: process.env.APP_DB_PASSWORD,
      database: process.env.PGDATABASE ?? "gestion_estacionamiento_test",
    });

    const currentUser = await pool.query<{ usuario: string }>(
      "SELECT current_user AS usuario",
    );
    expect(currentUser.rows[0].usuario).toBe("app_estacionamiento");

    const usuario = await pool.query<{ id: number }>(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ('Admin Integración M4', 'admin-m4@test.local', repeat('x', 60), 'admin')
       RETURNING id`,
    );
    usuarioId = usuario.rows[0].id;

    await pool.query(
      `INSERT INTO tarifas (tipo_vehiculo, tarifa_hora, fecha_desde)
       VALUES ('auto', 1500.50, '2020-01-01')`,
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  async function crearPlaza(tipoVehiculo = "auto"): Promise<number> {
    secuencia += 1;
    const plaza = await pool.query<{ id: number }>(
      `INSERT INTO plazas (numero, sector, tipo_vehiculo, estado)
       VALUES ($1, 'M4', $2, 'libre')
       RETURNING id`,
      [`M4-${secuencia}`, tipoVehiculo],
    );
    return plaza.rows[0].id;
  }

  async function crearCliente(saldo = "10000.00"): Promise<number> {
    secuencia += 1;
    const cliente = await pool.query<{ id: number }>(
      `INSERT INTO clientes (nombre, email, saldo_actual)
       VALUES ($1, $2, $3::numeric)
       RETURNING id`,
      [`Cliente M4 ${secuencia}`, `cliente-m4-${secuencia}@test.local`, saldo],
    );
    return cliente.rows[0].id;
  }

  it("usa el rol app_estacionamiento para todas las operaciones", async () => {
    const resultado = await pool.query<{ usuario: string }>(
      "SELECT current_user AS usuario",
    );
    expect(resultado.rows[0].usuario).toBe("app_estacionamiento");
  });


  it("deja pasar una sola entrada concurrente a la misma plaza", async () => {
    const plazaId = await crearPlaza();

    const intentos = await Promise.allSettled([
      registrarIngreso(
        pool,
        { patente: "ENTRADA1", plaza_id: plazaId, tipo_vehiculo: "auto" },
        { usuarioId },
      ),
      registrarIngreso(
        pool,
        { patente: "ENTRADA2", plaza_id: plazaId, tipo_vehiculo: "auto" },
        { usuarioId },
      ),
    ]);

    expect(intentos.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rechazado = intentos.find((r) => r.status === "rejected");
    expect(rechazado).toMatchObject({
      status: "rejected",
      reason: { code: "PLAZA_OCUPADA", status: 409 },
    });

    const movimientos = await pool.query<{ total: number }>(
      `SELECT count(*)::int AS total
         FROM movimientos
        WHERE plaza_id = $1 AND hora_salida IS NULL`,
      [plazaId],
    );
    expect(movimientos.rows[0].total).toBe(1);

    const plaza = await pool.query<{ estado: string }>(
      "SELECT estado FROM plazas WHERE id = $1",
      [plazaId],
    );
    expect(plaza.rows[0].estado).toBe("ocupada");
  });

  it("cobra una sola vez ante dos egresos concurrentes y conserva un recibo", async () => {
    const plazaId = await crearPlaza();
    const clienteId = await crearCliente("10000.00");
    await pool.query(
      `INSERT INTO vehiculos (patente, tipo, cliente_id)
       VALUES ('SALIDA1', 'auto', $1)`,
      [clienteId],
    );

    const ingreso = await registrarIngreso(
      pool,
      { patente: "SALIDA1", plaza_id: plazaId, tipo_vehiculo: "auto" },
      { usuarioId },
    );
    await pool.query(
      `UPDATE movimientos
          SET hora_entrada = now() - interval '61 minutes'
        WHERE id = $1`,
      [ingreso.movimiento.id],
    );

    const cobros = await Promise.all([
      registrarEgreso(
        pool,
        {
          movimiento_id: ingreso.movimiento.id,
          forma_pago: "saldo_prepago",
          registrar_como_deuda: false,
        },
        { usuarioId },
      ),
      registrarEgreso(
        pool,
        {
          movimiento_id: ingreso.movimiento.id,
          forma_pago: "saldo_prepago",
          registrar_como_deuda: false,
        },
        { usuarioId },
      ),
    ]);

    expect(cobros.filter((r) => !r.idempotente)).toHaveLength(1);
    expect(cobros.filter((r) => r.idempotente)).toHaveLength(1);
    expect(cobros[0].recibo?.id).toBe(cobros[1].recibo?.id);

    const recibos = await pool.query<{ total: number }>(
      "SELECT count(*)::int AS total FROM recibos WHERE movimiento_id = $1",
      [ingreso.movimiento.id],
    );
    expect(recibos.rows[0].total).toBe(1);

    const movimiento = await pool.query<{
      monto_calculado: string;
      monto_pagado: string;
    }>(
      `SELECT monto_calculado::text, monto_pagado::text
         FROM movimientos WHERE id = $1`,
      [ingreso.movimiento.id],
    );
    expect(movimiento.rows[0].monto_calculado).toBe("3001.00");
    expect(movimiento.rows[0].monto_pagado).toBe("3001.00");

    const cliente = await pool.query<{ saldo_actual: string }>(
      "SELECT saldo_actual::text FROM clientes WHERE id = $1",
      [clienteId],
    );
    expect(cliente.rows[0].saldo_actual).toBe("6999.00");

    // Conteo acotado a este movimiento/cliente: la auditoría es inmutable y
    // tests anteriores del mismo run dejan filas que no se pueden borrar.
    const auditoria = await pool.query<{ total: number }>(
      `SELECT count(*)::int AS total
         FROM auditoria_cambios
        WHERE (tabla = 'movimientos' AND accion = 'UPDATE' AND registro_id = $1)
           OR (tabla = 'recibos' AND accion = 'INSERT'
               AND registro_id IN (SELECT id FROM recibos WHERE movimiento_id = $1))
           OR (tabla = 'clientes' AND accion = 'UPDATE' AND registro_id = $2)`,
      [ingreso.movimiento.id, clienteId],
    );
    expect(auditoria.rows[0].total).toBe(3);
  });

  it("revierte movimiento, recibo, saldo y auditoría si falla la auditoría del egreso", async () => {
    const plazaId = await crearPlaza();
    const clienteId = await crearCliente("10000.00");
    await pool.query(
      `INSERT INTO vehiculos (patente, tipo, cliente_id)
       VALUES ('ROLLBACK1', 'auto', $1)`,
      [clienteId],
    );
    const ingreso = await registrarIngreso(
      pool,
      { patente: "ROLLBACK1", plaza_id: plazaId, tipo_vehiculo: "auto" },
      { usuarioId },
    );

    await expect(
      registrarEgreso(
        pool,
        {
          movimiento_id: ingreso.movimiento.id,
          forma_pago: "saldo_prepago",
          registrar_como_deuda: false,
        },
        { usuarioId, ip: "ip-invalida" },
      ),
    ).rejects.toThrow();

    const movimiento = await pool.query<{
      hora_salida: Date | null;
      monto_calculado: string;
      monto_pagado: string;
    }>(
      `SELECT hora_salida, monto_calculado::text, monto_pagado::text
         FROM movimientos WHERE id = $1`,
      [ingreso.movimiento.id],
    );
    expect(movimiento.rows[0].hora_salida).toBeNull();
    expect(movimiento.rows[0].monto_calculado).toBe("0.00");
    expect(movimiento.rows[0].monto_pagado).toBe("0.00");

    const recibos = await pool.query<{ total: number }>(
      "SELECT count(*)::int AS total FROM recibos WHERE movimiento_id = $1",
      [ingreso.movimiento.id],
    );
    expect(recibos.rows[0].total).toBe(0);

    const cliente = await pool.query<{ saldo_actual: string }>(
      "SELECT saldo_actual::text FROM clientes WHERE id = $1",
      [clienteId],
    );
    expect(cliente.rows[0].saldo_actual).toBe("10000.00");

    const auditoria = await pool.query<{ total: number }>(
      `SELECT count(*)::int AS total
         FROM auditoria_cambios
        WHERE (tabla = 'movimientos' AND accion = 'UPDATE' AND registro_id = $1)
           OR (tabla = 'recibos' AND accion = 'INSERT'
               AND registro_id IN (SELECT id FROM recibos WHERE movimiento_id = $1))
           OR (tabla = 'clientes' AND accion = 'UPDATE' AND registro_id = $2)`,
      [ingreso.movimiento.id, clienteId],
    );
    expect(auditoria.rows[0].total).toBe(0);
  });

  it("usa cero como monto cuando no existe tarifa, igual que PHP", async () => {
    const plazaId = await crearPlaza("moto");
    const ingreso = await registrarIngreso(
      pool,
      { patente: "SIN TARIFA", plaza_id: plazaId, tipo_vehiculo: "moto" },
      { usuarioId },
    );

    const egreso = await registrarEgreso(
      pool,
      {
        movimiento_id: ingreso.movimiento.id,
        forma_pago: "efectivo",
        registrar_como_deuda: false,
      },
      { usuarioId },
    );

    expect(egreso.calculo?.montoTotalCentavos).toBe(0);
    expect(egreso.movimiento.monto_calculado).toBe("0.00");
    expect(egreso.recibo?.monto).toBe("0.00");
  });
});


