/**
 * setupFiles de vitest: corre al inicio de CADA worker.
 *
 * Nota: la guardia de PGDATABASE del shell está en global-setup.ts (se ejecuta
 * antes de que .env.local contamine el env). La guardia por CONEXIÓN está en
 * db-setup.ts (assertTestDatabase) y en cada conexión (TEST_DB hardcodeado).
 *
 * Este archivo queda como punto de extensión para checks por-worker.
 */

export {};