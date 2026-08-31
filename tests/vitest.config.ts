import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 20000,
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/apps/miniapp/e2e/**'],
  },
  resolve: {
    alias: {
      '@telegram-commerce/config': path.resolve(__dirname, './packages/config/src/index.ts'),
      '@telegram-commerce/database': path.resolve(__dirname, './packages/database/src/index.ts'),
      '@telegram-commerce/payments': path.resolve(__dirname, './packages/payments/src/index.ts'),
      '@telegram-commerce/telegram-engine': path.resolve(__dirname, './packages/telegram-engine/src/index.ts'),
      '@telegram-commerce/ui': path.resolve(__dirname, './packages/ui/src/index.ts'),
    },
  },
});
