import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // NestJS's constructor DI relies on emitDecoratorMetadata, which esbuild
  // (Vitest's default transform) doesn't reliably produce. swc does.
  plugins: [swc.vite()],
  test: {
    exclude: ['**/node_modules/**', 'dist/**'],
  },
});
