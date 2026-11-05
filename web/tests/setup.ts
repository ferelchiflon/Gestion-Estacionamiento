/**
 * Test setup - Ejecutado antes de todos los tests.
 * Valida que las pruebas NO toquen la base real.
 */

import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
  // Validar variable de entorno PGDATABASE si está definida
  const pgDatabase = process.env.PGDATABASE;
  if (pgDatabase && !pgDatabase.endsWith('_test')) {
    throw new Error(
      `SEGURIDAD: PGDATABASE="${pgDatabase}" no termina en '_test'.\n` +
      `Los tests deben ejecutarse solo contra bases de test (ej: gestion_estacionamiento_test).`
    );
  }
  
  // Validar que no estemos conectados a la base real
  // Esta validación se hace en cada test al conectar
});

afterAll(() => {
  // Cleanup si es necesario
});

export {};