import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(root, 'src');
const required = [
  'src/public-api.ts',
  'src/lib/services/grafico-render.service.ts',
  'src/lib/renderers/@carta-astrale/carta-astrale.renderer.ts',
  'src/lib/renderers/@carta-astrale/latitudini.renderer.ts',
  'src/lib/renderers/moduli/segni.renderer.ts',
  'src/lib/renderers/moduli/case.renderer.ts',
  'src/lib/renderers/moduli/elementi-celesti.renderer.ts',
  'src/lib/renderers/moduli/aspetti.renderer.ts',
  'src/lib/renderers/moduli/transiti.renderer.ts',
  'src/lib/renderers/moduli/sinastria.renderer.ts',
];

const errors = [];
for (const path of required) if (!existsSync(join(root, path))) errors.push(`Missing: ${path}`);
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
const files = existsSync(sourceRoot) ? walk(sourceRoot).filter((p) => extname(p) === '.ts' && !p.includes('/_old/')) : [];
for (const path of files) {
  const content = readFileSync(path, 'utf8');
  const self = /(?:from\s+|import\s*)['\"]grafici-astrologici['\"]/g;
  if (self.test(content)) errors.push(`Package self-import: ${path}`);
  const matches = content.matchAll(/^\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['\"](\.[^'\"]+)['\"];?/gm);
  for (const match of matches) {
    const target = resolve(dirname(path), match[1]);
    if (![target + '.ts', join(target, 'index.ts'), target + '.js'].some(existsSync)) errors.push(`Unresolved relative import: ${path} -> ${match[1]}`);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Extraction integrity checks OK (${files.length} TypeScript source files). NOTE: this does not build, verify assets, or test actual rendering.`);
}
