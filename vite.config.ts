import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split Recharts into its own vendor chunk (~409KB)
          recharts: ['recharts'],
        },
      },
    },
  },
  esbuild: {
    // Strip console.log in production builds (keep warn/error)
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}));
