import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool, Client } from "pg";
import { runMigrations, loadEnvLocal } from "../../scripts/migrate.js";
import { getDeudasUnificadas, getDeudasMovimientos, marcarDeudaSaldada, registrarPagoParcialDeuda } from "../src/lib/deudas";
import { registrarIngreso, registrarEgreso } from "../src/lib/movimientos";
import { crearContrato, getPagosPendientes } from "../src/lib/alquiler";
import { centavosAPesosTexto } from "../src/lib/dinero";

let pool: Pool;
let usuarioId: number;
const TEST_DB = "gestion_estacionamiento_test";

describe("Módulo Deudas - Listado y Filtros", () => {
  beforeAll(async () => {
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

    const userRes = await pool.query<{ id: number }>(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ('Test User', 'test@deudas.com', '$2a$10$dummy', 'admin')
       RETURNING id`
    );
    usuarioId = userRes.rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  async function crearCliente(saldo = "0.00") {
    const res = await pool.query<{ id: number }>(
      `INSERT INTO clientes (nombre, documento, email, telefono, saldo_actual, estado)
       VALUES ('Cliente Deuda', '12345678', 'deuda@test.com', '1111111111', $1::numeric, 'activo')
       RETURNING id`,
      [saldo]
    );
    return res.rows[0].id;
  }

  async function crearPlaza(tipo = "auto", sector = "A") {
    const res = await pool.query<{ id: number }>(
      `INSERT INTO plazas (numero, sector, tipo_vehiculo, estado)
       VALUES (floor(random() * 10000)::text, $1, $2, 'libre')
       RETURNING id`,
      [sector, tipo]
    );
    return res.rows[0].id;
  }

  async function crearTarifa(tipo = "auto", monto = "1000.00") {
    await pool.query(
      `INSERT INTO tarifas (tipo_vehiculo, tarifa_hora, fecha_desde)
       VALUES ($1, $2::numeric, CURRENT_DATE)`,
      [tipo, monto]
    );
  }
it("getDeudasMovimientos devuelve deudas de movimientos con saldo negativo", async () => {
    await crearTarifa("auto", "1500.00");
    const clienteId = await crearCliente("0.00");
    const plazaId = await crearPlaza();

    await pool.query(
      `INSERT INTO vehiculos (patente, tipo, cliente_id)
       VALUES ('DEUDA001', 'auto', $1)`,
      [clienteId]
    );

    const ingreso = await registrarIngreso(pool, { patente: "DEUDA001", plaza_id: plazaId, tipo_vehiculo: "auto" }, { usuarioId });
    await registrarEgreso(pool, { movimiento_id: ingreso.movimiento.id, forma_pago: "saldo_prepago", registrar_como_deuda: true }, { usuarioId });

    const resultado = await getDeudasMovimientos(pool, { estado: "pendiente" });
    expect(resultado.data.length).toBeGreaterThanOrEqual(1);
    const deuda = resultado.data.find(d => d.movimiento_id === ingreso.movimiento.id);
    expect(deuda).toBeDefined();
    expect(deuda!.tipo).toBe("movimiento");
    expect(deuda!.cliente_id).toBe(clienteId);
    expect(parseFloat(deuda!.monto_con_interes)).toBeGreaterThan(0);
  });

  it("getDeudasMovimientos filtra por cliente_id", async () => {
    const clienteId1 = await crearCliente("0.00");
    const clienteId2 = await crearCliente("0.00");
    const plazaId = await crearPlaza();

    await pool.query(`INSERT INTO vehiculos (patente, tipo, cliente_id) VALUES ('FILTRO1', 'auto', $1)`, [clienteId1]);
    await pool.query(`INSERT INTO vehiculos (patente, tipo, cliente_id) VALUES ('FILTRO2', 'auto', $1)`, [clienteId2]);

    const ingreso1 = await registrarIngreso(pool, { patente: "FILTRO1", plaza_id: plazaId, tipo_vehiculo: "auto" }, { usuarioId });
    await registrarEgreso(pool, { movimiento_id: ingreso1.movimiento.id, forma_pago: "saldo_prepago", registrar_como_deuda: true }, { usuarioId });

    const plazaId2 = await crearPlaza("auto", "B");
    const ingreso2 = await registrarIngreso(pool, { patente: "FILTRO2", plaza_id: plazaId2, tipo_vehiculo: "auto" }, { usuarioId });
    await registrarEgreso(pool, { movimiento_id: ingreso2.movimiento.id, forma_pago: "saldo_prepago", registrar_como_deuda: true }, { usuarioId });

    const resultado1 = await getDeudasMovimientos(pool, { cliente_id: clienteId1, estado: "pendiente" });
    expect(resultado1.data.every(d => d.cliente_id === clienteId1)).toBe(true);

    const resultado2 = await getDeudasMovimientos(pool, { cliente_id: clienteId2, estado: "pendiente" });
    expect(resultado2.data.every(d => d.cliente_id === clienteId2)).toBe(true);
  });

  it("getDeudasAlquileres devuelve pagos pendientes de contratos vigentes", async () => {
    const clienteId = await crearCliente("0.00");
    const plazaId = await crearPlaza();

    await pool.query(
      `INSERT INTO tipos_alquiler (id, nombre)
       VALUES (2, 'Mensual')
       ON CONFLICT (id) DO NOTHING`
    );

    const contrato = await crearContrato(pool, {
      plaza_id: plazaId,
      cliente_id: clienteId,
      tipo_alquiler_id: 2,
      monto_total: "50000.00",
      dia_vencimiento: 5,
    }, { usuarioId });

    const pendientes = await getPagosPendientes(pool);
    expect(pendientes.length).toBeGreaterThanOrEqual(1);
    const p = pendientes.find(x => x.contrato_id === contrato.id);
    expect(p).toBeDefined();
    expect(p!.dias_retraso).toBeDefined();
  });
it("getDeudasUnificadas combina movimientos y alquileres", async () => {
    const resultado = await getDeudasUnificadas(pool, { tipo: "todas", estado: "pendiente", page: 1, limit: 50 });
    expect(resultado.data).toBeInstanceOf(Array);
    expect(resultado.resumen).toBeDefined();
    expect(typeof resultado.resumen.total_adeudado).toBe("string");
    expect(typeof resultado.resumen.deudas_criticas).toBe("number");
    expect(typeof resultado.resumen.clientes_con_deuda).toBe("number");
  });

  it("getDeudasUnificadas filtra por tipo movimiento", async () => {
    const resultado = await getDeudasUnificadas(pool, { tipo: "movimiento", estado: "pendiente", page: 1, limit: 50 });
    expect(resultado.data.every(d => d.tipo === "movimiento")).toBe(true);
  });

  it("getDeudasUnificadas filtra por tipo alquiler", async () => {
    const resultado = await getDeudasUnificadas(pool, { tipo: "alquiler", estado: "pendiente", page: 1, limit: 50 });
    expect(resultado.data.every(d => d.tipo === "alquiler")).toBe(true);
  });

  it("getDeudasUnificadas ordena por monto descendente", async () => {
    const resultado = await getDeudasUnificadas(pool, { tipo: "movimiento", estado: "pendiente", sort_by: "monto", sort_order: "desc", page: 1, limit: 50 });
    for (let i = 1; i < resultado.data.length; i++) {
      const montoA = parseFloat("monto_con_interes" in resultado.data[i-1] ? resultado.data[i-1].monto_con_interes : "0");
      const montoB = parseFloat("monto_con_interes" in resultado.data[i] ? resultado.data[i].monto_con_interes : "0");
      expect(montoA).toBeGreaterThanOrEqual(montoB);
    }
  });

  it("getDeudasUnificadas ordena por antigüedad descendente", async () => {
    const resultado = await getDeudasUnificadas(pool, { tipo: "movimiento", estado: "pendiente", sort_by: "antiguedad", sort_order: "desc", page: 1, limit: 50 });
    for (let i = 1; i < resultado.data.length; i++) {
      const antA = "dias_antiguedad" in resultado.data[i-1] ? resultado.data[i-1].dias_antiguedad : 0;
      const antB = "dias_antiguedad" in resultado.data[i] ? resultado.data[i].dias_antiguedad : 0;
      expect(antA).toBeGreaterThanOrEqual(antB);
    }
  });

  it("marcarDeudaSaldada marca una deuda como pagada", async () => {
    await crearTarifa("auto", "1000.00");
    const clienteId = await crearCliente("0.00");
    const plazaId = await crearPlaza();

    await pool.query(`INSERT INTO vehiculos (patente, tipo, cliente_id) VALUES ('SALDAR1', 'auto', $1)`, [clienteId]);
    const ingreso = await registrarIngreso(pool, { patente: "SALDAR1", plaza_id: plazaId, tipo_vehiculo: "auto" }, { usuarioId });
    await registrarEgreso(pool, { movimiento_id: ingreso.movimiento.id, forma_pago: "saldo_prepago", registrar_como_deuda: true }, { usuarioId });

    const deudasRes = await pool.query<{ id: number }>(`SELECT id FROM deudas WHERE movimiento_id = $1`, [ingreso.movimiento.id]);
    const deudaId = deudasRes.rows[0].id;

    await marcarDeudaSaldada(pool, deudaId, { usuarioId });

    const checkRes = await pool.query<{ estado: string }>(`SELECT estado FROM deudas WHERE id = $1`, [deudaId]);
    expect(checkRes.rows[0].estado).toBe("pagada");
  });

  it("registrarPagoParcialDeuda reduce el monto de la deuda", async () => {
    await crearTarifa("auto", "2000.00");
    const clienteId = await crearCliente("0.00");
    const plazaId = await crearPlaza();

    await pool.query(`INSERT INTO vehiculos (patente, tipo, cliente_id) VALUES ('PARCIAL1', 'auto', $1)`, [clienteId]);
    const ingreso = await registrarIngreso(pool, { patente: "PARCIAL1", plaza_id: plazaId, tipo_vehiculo: "auto" }, { usuarioId });
    await registrarEgreso(pool, { movimiento_id: ingreso.movimiento.id, forma_pago: "saldo_prepago", registrar_como_deuda: true }, { usuarioId });

    const deudasRes = await pool.query<{ id: number; monto_con_interes: string }>(`SELECT id, monto_con_interes FROM deudas WHERE movimiento_id = $1`, [ingreso.movimiento.id]);
    const deudaId = deudasRes.rows[0].id;
    const montoOriginal = parseFloat(deudasRes.rows[0].monto_con_interes);

    await registrarPagoParcialDeuda(pool, deudaId, { monto: centavosAPesosTexto(Math.round(montoOriginal * 100) / 2), forma_pago: "efectivo" }, { usuarioId });

    const checkRes = await pool.query<{ monto_con_interes: string }>(`SELECT monto_con_interes FROM deudas WHERE id = $1`, [deudaId]);
    const montoNuevo = parseFloat(checkRes.rows[0].monto_con_interes);
    expect(montoNuevo).toBeLessThan(montoOriginal);
    expect(montoNuevo).toBeGreaterThan(0);
  });

  it("registrarPagoParcialDeuda con monto total marca como pagada", async () => {
    await crearTarifa("auto", "1000.00");
    const clienteId = await crearCliente("0.00");
    const plazaId = await crearPlaza();

    await pool.query(`INSERT INTO vehiculos (patente, tipo, cliente_id) VALUES ('PARCIAL2', 'auto', $1)`, [clienteId]);
    const ingreso = await registrarIngreso(pool, { patente: "PARCIAL2", plaza_id: plazaId, tipo_vehiculo: "auto" }, { usuarioId });
    await registrarEgreso(pool, { movimiento_id: ingreso.movimiento.id, forma_pago: "saldo_prepago", registrar_como_deuda: true }, { usuarioId });

    const deudasRes = await pool.query<{ id: number; monto_con_interes: string }>(`SELECT id, monto_con_interes FROM deudas WHERE movimiento_id = $1`, [ingreso.movimiento.id]);
    const deudaId = deudasRes.rows[0].id;
    const montoTotal = deudasRes.rows[0].monto_con_interes;

    await registrarPagoParcialDeuda(pool, deudaId, { monto: montoTotal, forma_pago: "efectivo" }, { usuarioId });

    const checkRes = await pool.query<{ estado: string }>(`SELECT estado FROM deudas WHERE id = $1`, [deudaId]);
    expect(checkRes.rows[0].estado).toBe("pagada");
  });
});