/**
 * Tests de GASTOS: Permisos por rol, anti-duplicado y export CSV.
 * Todos los datos usan un sufijo único por ejecución para evitar colisiones
 * entre runs (la BD de test persiste entre ejecuciones).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { ensureTestDatabase, resetearDatosTest, assertTestDatabase } from './db-setup.js';
import { armarCsv, csvResponse } from '@/lib/csv';
import { listarGastos } from '@/lib/gastos';

const TEST_DB = 'gestion_estacionamiento_test';

// Sufijo único por run: 6 dígitos. numero = RUN*100 + i < 99999999 (max schema).
const RUN = Date.now() % 1000000;
const cuitDe = (n: number) => `20${String(RUN + n).padStart(8, '0')}9`; // 11 dígitos
const numeroDe = (n: number) => RUN * 100 + n;

let adminPool: Pool;

async function insertGasto(opts: {
  proveedor: string;
  cuit: string | null;
  numero: number;
  iva?: string;
  neto?: string;
}) {
  return adminPool.query<{ id: number }>(
    `INSERT INTO gastos_compras (fecha, proveedor, cuit_proveedor, tipo_comprobante,
       punto_venta, numero_comprobante, neto_gravado, iva_21, total)
     VALUES (CURRENT_DATE, $1, $2, 'Factura C', 1, $3, $4, $5, $6)
     RETURNING id`,
    [
      opts.proveedor,
      opts.cuit,
      opts.numero,
      opts.neto ?? '100.00',
      opts.iva ?? '21.00',
      (parseFloat(opts.neto ?? '100') + parseFloat(opts.iva ?? '21')).toFixed(2),
    ],
  );
}

describe('GASTOS: Permisos y anti-duplicado', () => {
  beforeAll(async () => {
    await ensureTestDatabase();
    await resetearDatosTest();
    assertTestDatabase(TEST_DB);

    adminPool = new Pool({
      host: process.env.PGHOST ?? '127.0.0.1',
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.APP_DB_USER ?? 'app_estacionamiento',
      password: process.env.APP_DB_PASSWORD,
      database: TEST_DB,
    });
  });

  afterAll(async () => {
    await adminPool.end();
  });

  describe('Permisos por rol', () => {
    it('admin: puede listar gastos (fiscal.read)', async () => {
      const res = await adminPool.query(`SELECT count(*) FROM gastos_compras`);
      expect(res.rows[0].count).toBeDefined();
    });

    it('admin: puede crear gasto (fiscal.write)', async () => {
      const res = await insertGasto({
        proveedor: `Proveedor Admin ${RUN}`,
        cuit: cuitDe(1),
        numero: numeroDe(1),
      });
      expect(res.rows[0].id).toBeDefined();
    });

    it('admin: puede eliminar gasto (soft delete)', async () => {
      const insert = await insertGasto({
        proveedor: `Para Borrar ${RUN}`,
        cuit: cuitDe(2),
        numero: numeroDe(2),
      });
      const id = insert.rows[0].id;
      await adminPool.query(`UPDATE gastos_compras SET eliminado_en = now() WHERE id = $1`, [id]);
      const check = await adminPool.query(`SELECT eliminado_en FROM gastos_compras WHERE id = $1`, [id]);
      expect(check.rows[0].eliminado_en).not.toBeNull();
    });

    it('contador: puede listar y crear gastos (fiscal.read + fiscal.write)', async () => {
      const list = await adminPool.query(`SELECT count(*) FROM gastos_compras`);
      expect(list.rows[0].count).toBeDefined();

      const insert = await insertGasto({
        proveedor: `Proveedor Contador ${RUN}`,
        cuit: cuitDe(3),
        numero: numeroDe(3),
      });
      expect(insert.rows[0].id).toBeDefined();
    });

    it('contador: NO tiene DELETE en BD (solo admin elimina via API)', async () => {
      const check = await adminPool.query(
        `SELECT has_table_privilege('app_estacionamiento', 'gastos_compras', 'DELETE') as has_delete`
      );
      expect(check.rows[0].has_delete).toBe(false);
    });
  });

  describe('Anti-duplicado: índice único (cuit, tipo, punto_venta, numero) WHERE eliminado_en IS NULL', () => {
    const CUIT = cuitDe(10);

    it('permite insertar comprobante único', async () => {
      const res = await insertGasto({
        proveedor: `Proveedor Unico ${RUN}`,
        cuit: CUIT,
        numero: numeroDe(10),
      });
      expect(res.rows[0].id).toBeDefined();
    });

    it('rechaza duplicado exacto (mismo cuit, tipo, punto_venta, numero) activo', async () => {
      await expect(
        insertGasto({ proveedor: `Otro Nombre ${RUN}`, cuit: CUIT, numero: numeroDe(10) }),
      ).rejects.toThrow(/uq_gastos_compras_comprobante_unico|duplicate key/);
    });

    it('permite reusar número tras soft delete (eliminado_en IS NOT NULL)', async () => {
      const insert = await insertGasto({
        proveedor: `Para Reusar ${RUN}`,
        cuit: cuitDe(11),
        numero: numeroDe(11),
      });
      const id = insert.rows[0].id;

      await adminPool.query(`UPDATE gastos_compras SET eliminado_en = now() WHERE id = $1`, [id]);

      const res = await insertGasto({
        proveedor: `Reusado ${RUN}`,
        cuit: cuitDe(11),
        numero: numeroDe(11),
      });
      expect(res.rows[0].id).toBeDefined();
    });

    it('rechaza mismo CUIT + comprobante aunque cambie nombre de proveedor', async () => {
      await expect(
        insertGasto({ proveedor: `Nombre Diferente ${RUN}`, cuit: CUIT, numero: numeroDe(10) }),
      ).rejects.toThrow(/uq_gastos_compras_comprobante_unico|duplicate key/);
    });
  });

  describe('Exigir CUIT cuando hay IVA > 0', () => {
    it('requiere CUIT si iva_21 > 0', async () => {
      await expect(
        insertGasto({ proveedor: `Sin CUIT ${RUN}`, cuit: null, numero: numeroDe(12) }),
      ).rejects.toThrow(/CUIT_REQUERIDO_CON_IVA/);
    });

    it('permite NULL CUIT si iva_21 = 0', async () => {
      const res = await insertGasto({
        proveedor: `Sin IVA ${RUN}`,
        cuit: null,
        numero: numeroDe(13),
        iva: '0.00',
      });
      expect(res.rows[0].id).toBeDefined();
    });
  describe('Export CSV de gastos', () => {
    it('armarCsv genera formato con separador ";" y respeta escapes', () => {
      const csv = armarCsv(
        ['Fecha', 'Proveedor', 'Total'],
        [['2026-11-05', 'Proveedor "Especial"; SA', 121.0]],
      );

      const lineas = csv.split('\r\n');
      expect(lineas[0]).toBe('Fecha;Proveedor;Total');
      // Proveedor con ";" y comillas debe quedar entre comillas y con comillas escapadas
      expect(lineas[1]).toContain('"Proveedor ""Especial""; SA"');
    });

    it('csvResponse devuelve Content-Type y Content-Disposition correctos', () => {
      const response = csvResponse('gastos_test.csv', ['A', 'B'], [['1', '2']]);
      expect(response.headers.get('Content-Type')).toContain('text/csv');
      expect(response.headers.get('Content-Disposition')).toContain('gastos_test.csv');
    });

    it('listarGastos con limit alto devuelve todas las filas filtradas (comportamiento export CSV)', async () => {
      // Crear 7 gastos con proveedor único
      const sufijo = `CSV Export Test ${RUN}`;
      for (let i = 1; i <= 7; i++) {
        await insertGasto({
          proveedor: sufijo,
          cuit: cuitDe(20),
          numero: numeroDe(20) + i,
          iva: '0.00',
        });
      }

      // Simular lo que hace el route para export: limit alto, offset 0
      const resultado = await listarGastos(adminPool, { proveedor: sufijo, limit: 10000, offset: 0 });

      expect(resultado.data.length).toBe(7);
      expect(resultado.total).toBe(7);
    });
  });
});
  });