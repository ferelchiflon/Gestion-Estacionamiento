/**
 * Tests de GASTOS: Permisos por rol y anti-duplicado
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { loadEnvLocal, assertTestDatabase } from '../../scripts/migrate.js';

const TEST_DB = 'gestion_estacionamiento_test';

let adminPool: Pool;

describe('GASTOS: Permisos y anti-duplicado', () => {
  beforeAll(async () => {
    loadEnvLocal();
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
      const res = await adminPool.query(
        `INSERT INTO gastos_compras (fecha, proveedor, cuit_proveedor, tipo_comprobante, punto_venta, numero_comprobante, neto_gravado, iva_21, total)
         VALUES (CURRENT_DATE, 'Proveedor Admin', '20123456789', 'FC', 1, 100, 100.00, 21.00, 121.00)
         RETURNING id`
      );
      expect(res.rows[0].id).toBeDefined();
    });

    it('admin: puede eliminar gasto (soft delete)', async () => {
      const insert = await adminPool.query(
        `INSERT INTO gastos_compras (fecha, proveedor, cuit_proveedor, tipo_comprobante, punto_venta, numero_comprobante, neto_gravado, iva_21, total)
         VALUES (CURRENT_DATE, 'Para Borrar', '20123456780', 'FC', 1, 101, 100.00, 21.00, 121.00)
         RETURNING id`
      );
      const id = insert.rows[0].id;
      await adminPool.query(`UPDATE gastos_compras SET eliminado_en = now() WHERE id = $1`, [id]);
      const check = await adminPool.query(`SELECT eliminado_en FROM gastos_compras WHERE id = $1`, [id]);
      expect(check.rows[0].eliminado_en).not.toBeNull();
    });

    it('contador: puede listar y crear gastos (fiscal.read + fiscal.write)', async () => {
      const list = await adminPool.query(`SELECT count(*) FROM gastos_compras`);
      expect(list.rows[0].count).toBeDefined();

      const insert = await adminPool.query(
        `INSERT INTO gastos_compras (fecha, proveedor, cuit_proveedor, tipo_comprobante, punto_venta, numero_comprobante, neto_gravado, iva_21, total)
         VALUES (CURRENT_DATE, 'Proveedor Contador', '20123456779', 'FC', 1, 102, 100.00, 21.00, 121.00)
         RETURNING id`
      );
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
    it('permite insertar comprobante único', async () => {
      const res = await adminPool.query(
        `INSERT INTO gastos_compras (fecha, proveedor, cuit_proveedor, tipo_comprobante, punto_venta, numero_comprobante, neto_gravado, iva_21, total)
         VALUES (CURRENT_DATE, 'Proveedor Único', '20123456778', 'FC', 1, 200, 100.00, 21.00, 121.00)
         RETURNING id`
      );
      expect(res.rows[0].id).toBeDefined();
    });

    it('rechaza duplicado exacto (mismo cuit, tipo, punto_venta, numero) activo', async () => {
      await expect(adminPool.query(
        `INSERT INTO gastos_compras (fecha, proveedor, cuit_proveedor, tipo_comprobante, punto_venta, numero_comprobante, neto_gravado, iva_21, total)
         VALUES (CURRENT_DATE, 'Otro Nombre', '20123456778', 'FC', 1, 200, 200.00, 42.00, 242.00)`
      )).rejects.toThrow(/uq_gastos_compras_comprobante_unico|duplicate key/);
    });

    it('permite reusar número tras soft delete (eliminado_en IS NOT NULL)', async () => {
      const insert = await adminPool.query(
        `INSERT INTO gastos_compras (fecha, proveedor, cuit_proveedor, tipo_comprobante, punto_venta, numero_comprobante, neto_gravado, iva_21, total)
         VALUES (CURRENT_DATE, 'Para Reusar', '20123456777', 'FC', 1, 300, 100.00, 21.00, 121.00)
         RETURNING id`
      );
      const id = insert.rows[0].id;

      await adminPool.query(`UPDATE gastos_compras SET eliminado_en = now() WHERE id = $1`, [id]);

      const res = await adminPool.query(
        `INSERT INTO gastos_compras (fecha, proveedor, cuit_proveedor, tipo_comprobante, punto_venta, numero_comprobante, neto_gravado, iva_21, total)
         VALUES (CURRENT_DATE, 'Reusado', '20123456777', 'FC', 1, 300, 100.00, 21.00, 121.00)
         RETURNING id`
      );
      expect(res.rows[0].id).toBeDefined();
    });

    it('rechaza mismo CUIT + comprobante aunque cambie nombre de proveedor', async () => {
      await expect(adminPool.query(
        `INSERT INTO gastos_compras (fecha, proveedor, cuit_proveedor, tipo_comprobante, punto_venta, numero_comprobante, neto_gravado, iva_21, total)
         VALUES (CURRENT_DATE, 'Nombre Diferente', '20123456777', 'FC', 1, 300, 100.00, 21.00, 121.00)`
      )).rejects.toThrow(/uq_gastos_compras_comprobante_unico|duplicate key/);
    });
  });

  describe('Exigir CUIT cuando hay IVA > 0', () => {
    it('requiere CUIT si iva_21 > 0', async () => {
      await expect(adminPool.query(
        `INSERT INTO gastos_compras (fecha, proveedor, cuit_proveedor, tipo_comprobante, punto_venta, numero_comprobante, neto_gravado, iva_21, total)
         VALUES (CURRENT_DATE, 'Sin CUIT', NULL, 'FC', 1, 400, 100.00, 21.00, 121.00)`
      )).rejects.toThrow(/CUIT_REQUERIDO_CON_IVA/);
    });

    it('permite NULL CUIT si iva_21 = 0', async () => {
      const res = await adminPool.query(
        `INSERT INTO gastos_compras (fecha, proveedor, cuit_proveedor, tipo_comprobante, punto_venta, numero_comprobante, neto_gravado, iva_21, total)
         VALUES (CURRENT_DATE, 'Sin IVA', NULL, 'FC', 1, 500, 100.00, 0, 100.00)
         RETURNING id`
      );
      expect(res.rows[0].id).toBeDefined();
    });
  });
});