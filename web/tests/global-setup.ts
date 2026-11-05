/**
 * globalSetup de vitest: prepara la base de test UNA sola vez antes de correr
 * cualquier archivo de test. Cada archivo solo se conecta (ver db-setup.ts).
 *
 * La guardia de PGDATABASE se hace acá, ANTES de cargar .env.local (que define
 * PGDATABASE=gestion_estacionamiento para la app y contaminaría el env).
 */

export default async function globalSetup(): Promise<void> {
  const shellPgd = process.env.PGDATABASE;
  if (shellPgd && !shellPgd.endsWith('_test')) {
    const msg =
      `SEGURIDAD: PGDATABASE="${shellPgd}" (definida en el shell) no termina en '_test'.\n` +
      `Los tests solo corren contra bases de test. Desexportá PGDATABASE o usá una base _test.`;
    // vitest corrompe los errores lanzados desde globalSetup: imprimir y abortar
    console.error(`\n${msg}\n`);
    process.exit(1);
  }

  const { ensureTestDatabase } = await import('./db-setup.js');
  await ensureTestDatabase();
}