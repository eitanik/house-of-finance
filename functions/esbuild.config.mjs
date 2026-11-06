import * as esbuild from 'esbuild';
import { mkdirSync } from 'fs';

mkdirSync('lib', { recursive: true });

const watch = process.argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'lib/index.js',
  external: ['firebase-admin', 'firebase-functions'],
  sourcemap: true,
  logLevel: 'info',
});

if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
