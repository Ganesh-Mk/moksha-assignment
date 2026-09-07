import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // `@/` rather than a forest of `../../..` — the alias is mirrored in
    // tsconfig so the editor and the bundler agree.
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    // 5173 is not a preference: it is the only origin authorised in the Google
    // Cloud console, so sign-in fails on any other port.
    port: 5173,
    strictPort: true,
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
