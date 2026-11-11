/**
 * Declaraciones de tipos para scripts/migrate.js (CommonJS sin tipos).
 */
export declare function runMigrations(database: string): Promise<number>;
export declare function loadEnvLocal(): void;
export declare function sha256(text: string): string;
export declare function listMigrationFiles(): Array<{
  file: string;
  version: string;
  sql: string;
}>;
export declare function assertTestDatabase(database: string): void;
export declare function buscarBackupReciente(dir: string):
  | { ok: false; motivo: string }
  | { ok: true; cantidad: number; archivo: string; bytes: number; edadMs: number };