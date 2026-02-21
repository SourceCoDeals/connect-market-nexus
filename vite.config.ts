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
          // Split large vendor chunks to reduce initial bundle size
          recharts: ['recharts'],
          tiptap: ['@tiptap/react', '@tiptap/starter-kit'],
          mapbox: ['mapbox-gl'],
        },
      },
    },
  },
  esbuild: {
    // N11 FIX: Only strip console.log (keep console.error/warn for error reporting)
    // Previous config used drop:['console'] which removed ALL console output
    pure: mode === 'production' ? ['console.log'] : [],
    drop: mode === 'production' ? ['debugger'] : [],
  },
}));
