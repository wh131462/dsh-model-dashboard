/**
 * Dual-face build.
 *
 * The Host half becomes one ESM module (Node); the Client half becomes one CJS
 * module wrapped in the Web page's `window.__ModuleLoader__` registration. The
 * wrapper contract and the external runtime modules (`react`, `react/jsx-runtime`)
 * are the same ones dsh-build-tools owns, reproduced here so the project needs no
 * dependency beyond esbuild.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));

await mkdir('dist', { recursive: true });

await build({
  entryPoints: ['src/host/index.js'],
  outfile: 'index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node20'],
  sourcemap: false,
  logLevel: 'info',
});

await build({
  entryPoints: ['src/client/index.jsx'],
  outfile: 'dist/client.bundle.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
  sourcemap: false,
  logLevel: 'info',
});

const bundle = await readFile('dist/client.bundle.js', 'utf8');
const wrapped = `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;\n${bundle}\nreturn module.exports; } });\n`;
await writeFile('client.js', wrapped);
console.log(`built client.js (${wrapped.length} bytes) for ${pkg.name}`);
