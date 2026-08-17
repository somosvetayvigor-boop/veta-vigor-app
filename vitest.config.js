import { defineConfig } from 'vitest/config';

// Config separada de vite.config.js a propósito: ese archivo carga
// VitePWA (genera service worker, manifest, etc.), que no aporta nada a
// tests unitarios y solo suma tiempo de arranque.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.js', 'tests/**/*.test.js'],
  },
});
