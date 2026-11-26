import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Playbooks run on the VALOR core. Tests load the core from a checkout next to this one (or VALOR_CORE),
// so the core's own dependencies come from its node_modules: run `npm install` there first.
const core = resolve(process.env.VALOR_CORE ?? resolve(import.meta.dirname, "../valor-core"));

export default defineConfig({
  resolve: { alias: { "@valor": resolve(core, "src") } },
  server: { fs: { allow: [core, import.meta.dirname] } },
  test: { include: ["*/test/**/*.test.ts"], testTimeout: 30000 },
});
