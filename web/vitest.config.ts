import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` lanza una excepción al importarse fuera del bundle de
      // Next (condición react-server). En tests lo mapeamos al stub oficial
      // del paquete para poder importar rutas de API y libs que lo usan.
      "server-only": path.resolve(
        __dirname,
        "node_modules/server-only/empty.js",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
    },
    // Setup compartido: la base de test se prepara UNA vez (tests/global-setup.ts)
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup.ts"],
    // isolate: false + fileParallelism: false → un solo worker, módulos compartidos,
    // sin relanzar node ni re-ejecutar migraciones por archivo.
    isolate: false,
    fileParallelism: false,
  },
});
