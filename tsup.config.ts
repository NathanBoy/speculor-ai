import { defineConfig } from 'tsup';

// speculor-ai ships as a CLI: a single ESM bundle with a node shebang.
// The core modules are bundled in, so the published artifact is self-contained
// and has zero runtime dependencies (mirroring the pico-http engineering bar).
export default defineConfig({
  entry: { cli: 'src/cli/index.ts' },
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  minify: true,
  splitting: false,
  treeshake: true,
  banner: () => ({ js: '#!/usr/bin/env node' }),
});
