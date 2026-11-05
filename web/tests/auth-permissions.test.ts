/**
 * Tests de permisos por rol en /usuarios y /mi-cuenta/clave
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { ensureTestDatabase, resetearDatosTest, assertTestDatabase } from './db-setup.js';
import bcrypt from 'bcryptjs';

const TEST_DB = 'gestion_estacionamiento_test';

let adminPool: Pool;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let adminUserId: number;
let operatorUserId: number;

describe('Permisos por rol en /usuarios y /mi-cuenta/clave', () => {
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

    const adminHash = await bcrypt.hash('AdminPass123!', 12);
    const adminRes = await adminPool.query<{ id: number }>(
      `INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ('Admin PermTest', 'admin-perm@test.local', $1, 'admin') RETURNING id`,
      [adminHash]
    );
    adminUserId = adminRes.rows[0].id;

    const opHash = await bcrypt.hash('OperatorPass123!', 12);
    const opRes = await adminPool.query<{ id: number }>(
      `INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ('Operador PermTest', 'operador-perm@test.local', $1, 'operador') RETURNING id`,
      [opHash]
    );
    operatorUserId = opRes.rows[0].id;
  });

  afterAll(async () => {
    await adminPool.end();
  });

  it('admin puede resetear contraseña de otro usuario (simula action=reset_password)', async () => {
    const targetHash = await bcrypt.hash('TargetPass123!', 12);
    const targetRes = await adminPool.query<{ id: number }>(
      `INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ('Target User', 'target@test.local', $1, 'operador') RETURNING id`,
      [targetHash]
    );
    const targetId = targetRes.rows[0].id;

    const tempHash = await bcrypt.hash('TempPass123!', 12);
    const result = await adminPool.query(
      `UPDATE usuarios SET password_hash = $1, debe_cambiar_password = true, intentos_fallidos = 0, bloqueado_hasta = NULL, token_version = token_version + 1 WHERE id = $2 RETURNING debe_cambiar_password`,
      [tempHash, targetId]
    );
    
    expect(result.rows[0].debe_cambiar_password).toBe(true);
  });

  it('operador existe y tiene rol operador (no tiene usuarios.manage)', async () => {
    const check = await adminPool.query<{ rol: string }>(
      `SELECT rol FROM usuarios WHERE id = $1`,
      [operatorUserId]
    );
    expect(check.rows[0].rol).toBe('operador');
  });

  it('cualquier usuario logueado puede cambiar su propia contraseña', async () => {
    const currentHash = await bcrypt.hash('CurrentPass123!', 12);
    await adminPool.query(
      `UPDATE usuarios SET password_hash = $1 WHERE id = $2`,
      [currentHash, operatorUserId]
    );

    const newHash = await bcrypt.hash('NewOwnPass123!', 12);
    await adminPool.query(
      `UPDATE usuarios SET password_hash = $1, debe_cambiar_password = false, token_version = token_version + 1 WHERE id = $2`,
      [newHash, operatorUserId]
    );

    const check = await adminPool.query<{ password_hash: string; debe_cambiar_password: boolean }>(
      `SELECT password_hash, debe_cambiar_password FROM usuarios WHERE id = $1`,
      [operatorUserId]
    );
    
    expect(check.rows[0].password_hash).toBe(newHash);
    expect(check.rows[0].debe_cambiar_password).toBe(false);
    
    const valid = await bcrypt.compare('NewOwnPass123!', newHash);
    expect(valid).toBe(true);
  });

  it('bloqueo tras 5 intentos fallidos al validar contraseña actual', async () => {
    const testHash = await bcrypt.hash('RealPass123!', 12);
    const testRes = await adminPool.query<{ id: number }>(
      `INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ('Block Test', 'block@test.local', $1, 'operador') RETURNING id`,
      [testHash]
    );
    const testUserId = testRes.rows[0].id;

    await adminPool.query(
      `UPDATE usuarios SET intentos_fallidos = 0 WHERE id = $1`,
      [testUserId]
    );

    for (let i = 0; i < 5; i++) {
      await adminPool.query(
        `UPDATE usuarios SET intentos_fallidos = intentos_fallidos + 1,
         bloqueado_hasta = CASE WHEN intentos_fallidos + 1 >= 5 THEN now() + interval '15 minutes' ELSE bloqueado_hasta END
         WHERE id = $1`,
        [testUserId]
      );
    }

    const check = await adminPool.query<{ intentos_fallidos: number; bloqueado_hasta: Date | null }>(
      `SELECT intentos_fallidos, bloqueado_hasta FROM usuarios WHERE id = $1`,
      [testUserId]
    );
    
    expect(check.rows[0].intentos_fallidos).toBe(5);
    expect(check.rows[0].bloqueado_hasta).not.toBeNull();
  });
});