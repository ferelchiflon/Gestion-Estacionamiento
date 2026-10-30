import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool, Client } from "pg";
import { runMigrations, loadEnvLocal } from "../../scripts/migrate.js";
import {
  crearGasto,
  listarGastos,
  totalesGastos,
  eliminarGasto,
  obtenerGasto,
} from "../src/lib/gastos";
import { pesosTextoACentavos, centavosAPesosTexto } from "../src/lib/dinero";

let pool: Pool;
let usuarioId: number;
const TEST_DB = "gestion_estacionamiento_test";

describe("Módulo Gastos/Compras", () => {
  beforeAll(async () => {
    loadEnvLocal();

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

    await runMigrations(TEST_DB);

    pool = new Pool({
      host: process.env.PGHOST ?? "127.0.0.1",
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.APP_DB_USER ?? "app_estacionamiento",
      password: process.env.APP_DB_PASSWORD,
      database: TEST_DB,
    });

    const userRes = await pool.query<{ id: number }>(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ('Test User', 'test@gastos.com', '$2a$10$dummy', 'admin')
       RETURNING id`,
    );
    usuarioId = userRes.rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  type DatosGasto = {
    fecha: string;
    proveedor: string;
    cuit_proveedor: string | null;
    tipo_comprobante: string;
    punto_venta: number | null;
    numero_comprobante: number | null;
    neto_gravado: string;
    iva_21: string;
    iva_105: string;
    iva_27: string;
    no_gravado: string;
    percepcion_iva: string;
    percepcion_iibb: string;
    categoria_id: number | null;
    forma_pago: string | null;
    notas: string | null;
  };

  function datosGasto(overrides: Partial<DatosGasto> = {}): DatosGasto {
    return {
      fecha: "2026-10-15",
      proveedor: "Proveedor Test SA",
      cuit_proveedor: "20123456789",
      tipo_comprobante: "Factura A",
      punto_venta: 1,
      numero_comprobante: Math.floor(Math.random() * 99999999),
      neto_gravado: "1000.00",
      iva_21: "210.00",
      iva_105: "0.00",
      iva_27: "0.00",
      no_gravado: "0.00",
      percepcion_iva: "0.00",
      percepcion_iibb: "0.00",
      categoria_id: null,
      forma_pago: "efectivo",
      notas: null,
      ...overrides,
    };
  }

  function toDateStr(d: Date | string): string {
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
  }

  function datosGastoUnique(year: number, overrides: Partial<DatosGasto> = {}): DatosGasto {
    return {
      ...datosGasto(),
      fecha: `${year}-10-15`,
      numero_comprobante: Math.floor(Math.random() * 99999999),
      ...overrides,
    };
  }

  it("crearGasto calcula el total en centavos (neto + iva + no gravado + percepciones)", async () => {
    const gasto = await crearGasto(
      pool,
      datosGastoUnique(2023, {
        neto_gravado: "1234.56",
        iva_21: "259.26",
        no_gravado: "10.00",
        percepcion_iibb: "3.18",
      }),
      { usuarioId },
    );

    const totalCentavos =
      pesosTextoACentavos("1234.56") +
      pesosTextoACentavos("259.26") +
      pesosTextoACentavos("0.00") +
      pesosTextoACentavos("0.00") +
      pesosTextoACentavos("10.00") +
      pesosTextoACentavos("0.00") +
      pesosTextoACentavos("3.18");

    expect(gasto.total).toBe(centavosAPesosTexto(totalCentavos));
    expect(gasto.total).toBe("1507.00");

    const auditoria = await pool.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM auditoria_cambios
        WHERE tabla = 'gastos_compras' AND accion = 'INSERT' AND registro_id = $1`,
      [gasto.id],
    );
    expect(auditoria.rows[0].total).toBe(1);
  });

  it("crearGasto con comprobante duplicado lanza GASTO_DUPLICADO (409)", async () => {
    const datos = datosGastoUnique(2024, { punto_venta: 7, numero_comprobante: 12345678 });

    await crearGasto(pool, datos, { usuarioId });

    await expect(crearGasto(pool, datos, { usuarioId })).rejects.toMatchObject({
      status: 409,
      code: "GASTO_DUPLICADO",
    });
  });

  it("crearGasto permite mismo comprobante si cambió el proveedor (y CUIT)", async () => {
    const base = { punto_venta: 8, numero_comprobante: 22222222 };

    const a = await crearGasto(pool, datosGastoUnique(2025, { ...base, proveedor: "Proveedor A", cuit_proveedor: "20111111111" }), { usuarioId });
    const b = await crearGasto(pool, datosGastoUnique(2025, { ...base, proveedor: "Proveedor B", cuit_proveedor: "20222222222" }), { usuarioId });

    expect(a.id).not.toBe(b.id);
  });

  it("crearGasto permite reingresar comprobante tras soft delete del original", async () => {
    const datos = datosGastoUnique(2026, { punto_venta: 9, numero_comprobante: 33333333 });
    const gasto = await crearGasto(pool, datos, { usuarioId });

    await eliminarGasto(pool, gasto.id, { usuarioId });

    const reingresado = await crearGasto(pool, datos, { usuarioId });
    expect(reingresado.id).not.toBe(gasto.id);
  });

  it("listarGastos filtra por rango de fechas", async () => {
    await crearGasto(pool, datosGasto({ fecha: "2020-01-10", numero_comprobante: 91000001 }), { usuarioId });
    await crearGasto(pool, datosGasto({ fecha: "2020-02-05", numero_comprobante: 91000002 }), { usuarioId });
    await crearGasto(pool, datosGasto({ fecha: "2020-02-20", numero_comprobante: 91000003 }), { usuarioId });
    await crearGasto(pool, datosGasto({ fecha: "2020-03-02", numero_comprobante: 91000004 }), { usuarioId });

    const febrero = await listarGastos(pool, {
      fecha_desde: "2020-02-01",
      fecha_hasta: "2020-02-29",
    });

    expect(febrero.data.length).toBe(2);
    expect(febrero.data.every((g) => {
      const fecha = toDateStr(g.fecha);
      return fecha >= "2020-02-01" && fecha <= "2020-02-29";
    })).toBe(true);
  });

  it("listarGastos filtra por categoría", async () => {
    const catRes = await pool.query<{ id: number }>(
      `INSERT INTO categorias_gasto (nombre, activa) VALUES ('Limpieza Test', true) RETURNING id`,
    );
    const categoriaId = catRes.rows[0].id;

    await crearGasto(pool, datosGasto({ numero_comprobante: 42000001, categoria_id: null, fecha: "2021-05-01" }), { usuarioId });
    await crearGasto(pool, datosGasto({ numero_comprobante: 42000002, categoria_id: categoriaId, fecha: "2021-05-02" }), { usuarioId });

    const conCategoria = await listarGastos(pool, { categoria_id: categoriaId });

    expect(conCategoria.data.length).toBe(1);
    expect(conCategoria.data[0].categoria_id).toBe(categoriaId);
    expect(conCategoria.data[0].categoria_nombre).toBe("Limpieza Test");
  });

  it("listarGastos filtra por proveedor (ILIKE)", async () => {
    await crearGasto(pool, datosGasto({ proveedor: "Distribuidora Alfa", numero_comprobante: 43000001, fecha: "2022-08-01" }), { usuarioId });
    await crearGasto(pool, datosGasto({ proveedor: "Servicios Beta", numero_comprobante: 43000002, fecha: "2022-08-02" }), { usuarioId });

    const alfa = await listarGastos(pool, { proveedor: "ALFA" });

    expect(alfa.data.length).toBe(1);
    expect(alfa.data[0].proveedor).toBe("Distribuidora Alfa");
  });

  it("totalesGastos suma neto, IVA y total del período", async () => {
    await crearGasto(pool, datosGasto({
      fecha: "2019-06-01",
      numero_comprobante: 94000001,
      neto_gravado: "1000.00",
      iva_21: "210.00",
    }), { usuarioId });
    await crearGasto(pool, datosGasto({
      fecha: "2019-06-15",
      numero_comprobante: 94000002,
      neto_gravado: "500.00",
      iva_21: "0",
      iva_105: "52.50",
    }), { usuarioId });

    const totales = await totalesGastos(pool, {
      fecha_desde: "2019-06-01",
      fecha_hasta: "2019-06-30",
    });

    expect(totales.comprobantes).toBe(2);
    expect(pesosTextoACentavos(totales.neto_gravado)).toBe(150000);
    expect(pesosTextoACentavos(totales.iva)).toBe(26250);
    expect(pesosTextoACentavos(totales.total)).toBe(176250);
  });

  it("eliminarGasto hace soft delete y queda fuera del listado", async () => {
    const gasto = await crearGasto(pool, datosGastoUnique(2027, { numero_comprobante: 45000001 }), { usuarioId });

    await eliminarGasto(pool, gasto.id, { usuarioId });

    const obtenido = await obtenerGasto(pool, gasto.id);
    expect(obtenido).toBeNull();

    const listado = await listarGastos(pool, { proveedor: "Proveedor Test SA" });
    expect(listado.data.some((g) => g.id === gasto.id)).toBe(false);

    const crudo = await pool.query<{ eliminado_en: Date | null }>(
      `SELECT eliminado_en FROM gastos_compras WHERE id = $1`,
      [gasto.id],
    );
    expect(crudo.rows[0].eliminado_en).not.toBeNull();

    const auditoria = await pool.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM auditoria_cambios
        WHERE tabla = 'gastos_compras' AND accion = 'DELETE' AND registro_id = $1`,
      [gasto.id],
    );
    expect(auditoria.rows[0].total).toBe(1);
  });

  it("eliminarGasto sobre gasto inexistente lanza 404", async () => {
    await expect(eliminarGasto(pool, 999999, { usuarioId })).rejects.toMatchObject({
      status: 404,
      code: "GASTO_NO_ENCONTRADO",
    });
  });
});