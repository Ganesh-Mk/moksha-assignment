import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
// `vitest/config` rather than `vite`: it is the same defineConfig widened with
// the `test` block, so the config stays one file instead of two.
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // `@/` rather than a forest of `../../..` — the alias is mirrored in
    // tsconfig so the editor and the bundler agree.
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
  server: {
    // 5173 is not a preference: it is the only origin authorised in the Google
    // Cloud console, so sign-in fails on any other port.
    port: 5173,
    strictPort: true,
  },
  test: {
    // jsdom rather than node: the cart store touches localStorage through
    // zustand's persist middleware, which has no window to hang off otherwise.
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  build: {
    // Source maps for a deployed build: an error report from the live demo is
    // worth far more than the few hundred KB of .map files it costs.
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split the big, rarely-changing dependencies into their own chunks so
        // a change to application code does not invalidate them in the
        // browser cache.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\/]node_modules[\/](react|react-dom|react-router|scheduler)[\/]/.test(id)) {
            return "react";
          }
          if (id.includes("@tanstack")) return "query";
          if (id.includes("@radix-ui")) return "radix";
          return undefined;
        },
      },
    },
  },
});
