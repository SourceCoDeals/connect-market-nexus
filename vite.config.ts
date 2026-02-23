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
    // Target modern browsers for smaller output
    target: 'es2020',
    // Enable minification
    minify: 'esbuild',
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          // Core React libraries — cached separately and rarely change
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
          // React Router
          if (id.includes('node_modules/react-router') || id.includes('node_modules/@remix-run/router')) {
            return 'router-vendor';
          }
          // TanStack React Query
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'query-vendor';
          }
          // Supabase client libraries
          if (id.includes('node_modules/@supabase/')) {
            return 'supabase-vendor';
          }
          // Chart libraries (recharts + d3)
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'charts-vendor';
          }
          // Rich text editor (tiptap)
          if (id.includes('node_modules/@tiptap/') || id.includes('node_modules/prosemirror')) {
            return 'editor-vendor';
          }
          // Map libraries
          if (id.includes('node_modules/mapbox-gl')) {
            return 'mapbox-vendor';
          }
          // Date utilities
          if (id.includes('node_modules/date-fns')) {
            return 'date-vendor';
          }
          // Radix UI primitives (shared across many components)
          if (id.includes('node_modules/@radix-ui/')) {
            return 'radix-vendor';
          }
          // Lucide icons
          if (id.includes('node_modules/lucide-react')) {
            return 'icons-vendor';
          }
          // DocuSeal (e-signature, rarely used — separate chunk)
          if (id.includes('node_modules/@docuseal/')) {
            return 'docuseal-vendor';
          }
          // CSV parsing + document generation (used only for imports/exports)
          if (id.includes('node_modules/papaparse') || id.includes('node_modules/docx') || id.includes('node_modules/file-saver')) {
            return 'file-utils-vendor';
          }
          // All other node_modules go in a general vendor chunk
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
          return undefined;
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
