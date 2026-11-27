import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the built game also works from a subfolder.
  base: './',
  worker: {
    // The SQL worker uses ES module imports (sql.js, the seed file).
    format: 'es',
  },
  optimizeDeps: {
    // sql.js is a CommonJS/UMD file. Pre-bundling converts it to an ES module
    // in dev; listing it explicitly makes sure the worker's import is covered.
    include: ['sql.js'],
  },
  build: {
    target: 'es2022',
  },
});
