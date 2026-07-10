import { defineConfig } from "vitest/config";
import path from "node:path";

// Minimaler Vitest-Setup für reine, IO-freie Rechenkerne (lib/*.ts).
// Kein React-Testing nötig -> Node-Umgebung reicht.
export default defineConfig({
  resolve: {
    alias: {
      // Spiegelt den "@/*" Path-Alias aus tsconfig.json ("@/*": ["./*"])
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "dist/**", "build/**"],
  },
});
