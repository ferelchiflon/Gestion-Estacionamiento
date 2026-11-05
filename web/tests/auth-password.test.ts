/**
 * Tests de reset de contraseña y cambio de propia contraseña
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { ensureTestDatabase, resetearDatosTest } from './db-setup.js';
import bcrypt from 'bcryptjs';

const TEST_DB = 'gestion_estacionamiento_test';

let adminPool: Pool;
let adminUserId: number;
let testUserId: number;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let operatorUserId: number;

describe('Auth: Reset de contraseña y cambio propio', () => {
  beforeAll(async () => {
    

    // Setup compartido: garantiza base de test al dia (idempotente)
    await ensureTestDatabase();
    await resetearDatosTest();

    adminPool = new Pool({
      host: process.env.PGHOST ?? '127.0.0.1',
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.APP_DB_USER ?? 'app_estacionamiento',
      password: process.env.APP_DB_PASSWORD,
      database: TEST_DB,
    });

    const adminHash = await bcrypt.hash('AdminPass123!', 12);
    const adminRes = await adminPool.query<{ id: number }>(
      `INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ('Admin Test', 'admin@test.local', $1, 'admin') RETURNING id`,
      [adminHash]
    );
    adminUserId = adminRes.rows[0].id;

    const opHash = await bcrypt.hash('OperatorPass123!', 12);
    const opRes = await adminPool.query<{ id: number }>(
      `INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ('Operador Test', 'operador@test.local', $1, 'operador') RETURNING id`,
      [opHash]
    );
    operatorUserId = opRes.rows[0].id;

    const testHash = await bcrypt.hash('TestPass123!', 12);
    const testRes = await adminPool.query<{ id: number }>(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, intentos_fallidos, bloqueado_hasta) VALUES ('Test User', 'test@reset.local', $1, 'operador', 5, now() + interval '15 minutes') RETURNING id`,
      [testHash]
    );
    testUserId = testRes.rows[0].id;
  });

  afterAll(async () => {
    await adminPool.end();
  });

  it('cambio de contraseña - cambia hash y limpia debe_cambiar_password', async () => {
    const newHash = await bcrypt.hash('NewPass123!', 12);
    await adminPool.query(
      `UPDATE usuarios SET password_hash = $1, debe_cambiar_password = false, token_version = token_version + 1 WHERE id = $2`,
      [newHash, testUserId]
    );

    const check = await adminPool.query<{ password_hash: string; debe_cambiar_password: boolean }>(
      `SELECT password_hash, debe_cambiar_password FROM usuarios WHERE id = $1`,
      [testUserId]
    );
    
    expect(check.rows[0].password_hash).toBe(newHash);
    expect(check.rows[0].debe_cambiar_password).toBe(false);
  });

  it('reset_password - desbloquea cuenta (intentos_fallidos=0, bloqueado_hasta=NULL)', async () => {
    let check = await adminPool.query<{ intentos_fallidos: number; bloqueado_hasta: Date | null }>(
      `SELECT intentos_fallidos, bloqueado_hasta FROM usuarios WHERE id = $1`,
      [testUserId]
    );
    expect(check.rows[0].intentos_fallidos).toBe(5);
    expect(check.rows[0].bloqueado_hasta).not.toBeNull();

    const newHash = await bcrypt.hash('TempPass123!', 12);
    await adminPool.query(
      `UPDATE usuarios SET password_hash = $1, intentos_fallidos = 0, bloqueado_hasta = NULL, debe_cambiar_password = true, token_version = token_version + 1 WHERE id = $2`,
      [newHash, testUserId]
    );

    check = await adminPool.query<{ intentos_fallidos: number; bloqueado_hasta: Date | null; debe_cambiar_password: boolean }>(
      `SELECT intentos_fallidos, bloqueado_hasta, debe_cambiar_password FROM usuarios WHERE id = $1`,
      [testUserId]
    );
    
    expect(check.rows[0].intentos_fallidos).toBe(0);
    expect(check.rows[0].bloqueado_hasta).toBeNull();
    expect(check.rows[0].debe_cambiar_password).toBe(true);
  });

  it('auditoría - no guarda hashes en antes/despues', async () => {
    const newHash = await bcrypt.hash('AuditPass123!', 12);
    await adminPool.query(
      `UPDATE usuarios SET password_hash = $1, token_version = token_version + 1 WHERE id = $2`,
      [newHash, testUserId]
    );

    await adminPool.query(
      `INSERT INTO auditoria_cambios (usuario_id, accion, tabla, registro_id, antes, despues, ip)
       VALUES ($1, 'UPDATE', 'usuarios', $2, $3::jsonb, $4::jsonb, NULL)`,
      [adminUserId, testUserId, 
       JSON.stringify({ intentos_fallidos: 0 }), 
       JSON.stringify({ password_cambiada: true, intentos_fallidos: 0 })]
    );

    interface AuditRow { antes: Record<string, unknown> | null; despues: Record<string, unknown> | null; }
    const audit = await adminPool.query<AuditRow>(
      `SELECT antes, despues FROM auditoria_cambios WHERE tabla='usuarios' AND registro_id=$1 ORDER BY id DESC LIMIT 1`,
      [testUserId]
    );

    expect(JSON.stringify(audit.rows[0].antes)).not.toContain('password_hash');
    expect(JSON.stringify(audit.rows[0].despues)).not.toContain('password_hash');
    expect(JSON.stringify(audit.rows[0].despues)).not.toContain('AuditPass123!');
  });
});