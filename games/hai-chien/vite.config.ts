import { defaultClientConditions, defineConfig } from 'vite';

/** The client bundle: dist/index.html with relative paths, served by the Hub at /games/<id>/. */
export default defineConfig({
  root: 'client',
  base: './',
  resolve: { conditions: ['xomdao-source', ...defaultClientConditions] },
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
});
