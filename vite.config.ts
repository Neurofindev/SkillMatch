import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-core',
              priority: 30,
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
            },
            {
              name: 'supabase',
              priority: 20,
              test: /node_modules[\\/]@supabase[\\/]/,
            },
            {
              name: 'forms',
              priority: 20,
              test: /node_modules[\\/](react-hook-form|@hookform|zod)[\\/]/,
            },
            {
              name: 'query',
              priority: 20,
              test: /node_modules[\\/]@tanstack[\\/]/,
            },
            {
              name: 'interface',
              priority: 10,
              test: /node_modules[\\/](@radix-ui|lucide-react)[\\/]/,
            },
          ],
          minSize: 20_000,
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
