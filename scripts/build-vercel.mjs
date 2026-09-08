import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isAbsolute, relative, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const cli = require.resolve('@nuxt/cli/cli');
const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
// Nuxt cleanup is the supported way to remove its build outputs and caches.
// In particular, stale .output/public HTML must not be served by the temporary
// nitro-prerender server while producing a new Vercel artifact. Stop a local
// server using these generated files before this command; cleanup failure stops
// the build instead of silently accepting pages from an older deployment.
const generatedDirectories = ['.nuxt', '.output', 'dist', 'node_modules/.vite', 'node_modules/.cache'];
for (const directory of generatedDirectories) {
  const target = resolve(root, directory);
  const resolved = existsSync(target) ? realpathSync(target) : target;
  const within = relative(root, resolved);
  if (!within || within.startsWith('..') || isAbsolute(within)) throw new Error(`Generated cleanup target is outside the workspace: ${directory}`);
}
const cleanup = spawnSync(process.execPath, [cli, 'cleanup'], { cwd: root, stdio: 'inherit' });
if (cleanup.status !== 0) process.exit(cleanup.status || 1);
// This Nuxt CLI catches filesystem removal errors, so verify the result too.
// A locked Windows output directory must fail closed before the next build.
for (const directory of generatedDirectories) {
  if (existsSync(resolve(root, directory))) throw new Error(`Nuxt cleanup left ${directory}; stop local servers using generated files and retry`);
}
const build = spawnSync(process.execPath, [cli, 'build'], { cwd: root, stdio: 'inherit', env: { ...process.env, NITRO_PRESET: 'vercel', OT_BUILD_MODE: '1' } });
if (build.status !== 0) process.exit(build.status || 1);
for (const script of ['scripts/seo-build-check.mjs', 'scripts/build-asset-check.mjs']) {
  const verify = spawnSync(process.execPath, [script, '.vercel/output/static'], { cwd: root, stdio: 'inherit' });
  if (verify.status !== 0) process.exit(verify.status || 1);
}
