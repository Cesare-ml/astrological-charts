import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importTargets, nonLiteralImportLocations } from './extraction-imports.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(root, 'src');
const required = [
  'src/public-api.ts',
  'src/lib/models/tema-render.model.ts',
  'src/lib/services/grafico-render.service.ts',
  'src/lib/renderers/@skin-manager.ts',
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
const report = (path) => relative(root, path).split(sep).join('/');
for (const path of required) {
  if (!existsSync(join(root, path))) errors.push(`Missing source: ${path}`);
}
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : (entry.isFile() ? [path] : []);
  });
}
function resolvesLocally(origin, specifier) {
  const target = resolve(dirname(origin), specifier);
  const candidates = [target, `${target}.ts`, `${target}.tsx`, `${target}.js`, `${target}.json`, join(target, 'index.ts'), join(target, 'index.js')];
  return candidates.some((path) => existsSync(path) && statSync(path).isFile());
}
const files = existsSync(sourceRoot)
  ? walk(sourceRoot).filter((path) => ['.ts', '.tsx'].includes(extname(path)) && !path.split(sep).includes('_old'))
  : [];
const specifiers = new Set();
for (const path of files) {
  const content = readFileSync(path, 'utf8');
  for (const location of nonLiteralImportLocations(content)) {
    errors.push(`Non-literal dynamic import ${report(path)}:${location}; use a static module specifier`);
  }
  for (const specifier of importTargets(content)) {
    specifiers.add(specifier);
    if (specifier === 'grafici-astrologici' || specifier.startsWith('grafici-astrologici/')) {
      errors.push(`Self-import ${report(path)} -> ${specifier}`);
    } else if (specifier.startsWith('.') && !resolvesLocally(path, specifier)) {
      errors.push(`Broken relative import ${report(path)} -> ${specifier}`);
    }
  }
}
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const declared = { ...packageJson.dependencies, ...packageJson.peerDependencies, ...packageJson.devDependencies };
for (const item of specifiers) {
  if (item.startsWith('.')) continue;
  const pkgName = item.startsWith('@') ? item.split('/').slice(0, 2).join('/') : item.split('/')[0];
  if (!declared[pkgName] && !pkgName.startsWith('node:')) errors.push(`Undeclared package import: ${item}`);
}
if (errors.length) {
  console.error(`Extraction preflight failed (${errors.length}):\n${errors.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Extraction structure OK: ${files.length} TS files; ${specifiers.size} unique import specifiers. No independent compilation or rendering implied.`);
}
