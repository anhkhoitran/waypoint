import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // NestJS's constructor DI relies on emitDecoratorMetadata, which esbuild
  // (Vitest's default transform) doesn't reliably produce. swc does.
  plugins: [swc.vite()],
  test: {
    exclude: ['**/node_modules/**', 'dist/**'],
    // The e2e suite boots the full AppModule, which now runs two BullMQ
    // queues (crawl, extract) — their Redis connections take longer than
    // Vitest's 10s default to close cleanly in afterAll.
    hookTimeout: 20_000,
  },
});
