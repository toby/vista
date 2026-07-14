/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// Pure client-side app: relative base so the build runs from any static host.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
