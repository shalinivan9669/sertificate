import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const css = await readFile('assets/css/editorial.css', 'utf8');
const tokens = Object.fromEntries([...css.matchAll(/--ed-([a-z-]+):\s*(#[a-f\d]{3,6})\s*;/gi)].map(match => [match[1], match[2]]));
function luminance(hex) {
  let raw = hex.slice(1); if (raw.length === 3) raw = [...raw].map(c => c + c).join('');
  const values = [0, 2, 4].map(i => parseInt(raw.slice(i, i + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
}
const pairs = [
  ['main text', 'ink', 'paper', 4.5], ['secondary text', 'muted', 'paper', 4.5],
  ['secondary inset text', 'muted', 'soft', 4.5], ['dark surface text', 'cream', 'night', 4.5],
  ['dark secondary text', 'muted-dark', 'ink', 4.5], ['primary action', 'ink', 'amber', 4.5],
  ['dark action accent', 'amber', 'ink', 4.5], ['success', 'success', 'success-bg', 4.5],
  ['error', 'error', 'error-bg', 4.5], ['warning', 'warning', 'warning-bg', 4.5],
  ['field outline', 'field', 'white', 3], ['light surface focus', 'focus', 'paper', 3], ['dark surface focus', 'focus', 'night', 3],
];
const checks = pairs.map(([name, foreground, background, minimum]) => {
  const a = luminance(tokens[foreground]), b = luminance(tokens[background]);
  const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  return { name, foreground: tokens[foreground], background: tokens[background], ratio: Number(ratio.toFixed(2)), minimum, passed: ratio >= minimum };
});
const report = { generatedAt: new Date().toISOString(), scope: 'Semantic solid-color token pairs only. Photograph overlays, antialiasing and every incidental element are not certified by this check.', checks };
const output = resolve('artifacts/redesign/2026-09-14/after-final'); await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'contrast-tokens.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exitCode = checks.every(check => check.passed) ? 0 : 1;
