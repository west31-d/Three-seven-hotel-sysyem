import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@travel/domain': fileURLToPath(
        new URL('./packages/domain/src/index.ts', import.meta.url),
      ),
      '@travel/data': fileURLToPath(
        new URL('./packages/data/src/index.ts', import.meta.url),
      ),
      '@travel/ui': fileURLToPath(
        new URL('./packages/ui/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.ts'],
    css: false,
  },
});
