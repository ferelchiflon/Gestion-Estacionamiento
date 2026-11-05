import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
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
