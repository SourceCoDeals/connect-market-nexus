import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: '::',
    port: 8080,
  },
  plugins: [react(), mode === 'development' && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
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
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router-vendor': ['react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'date-vendor': ['date-fns'],
          'icons-vendor': ['lucide-react'],
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
