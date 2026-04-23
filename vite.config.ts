import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    include: [
      'monaco-editor/esm/vs/editor/editor.api',
      'monaco-editor/esm/vs/language/typescript/monaco.contribution',
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
});
