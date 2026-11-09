#!/usr/bin/env node
// Read-only source/host inventory: files are never copied into this package.
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { validatePath } from './asset-manifest.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SOURCE = resolve(HERE, '../src');
const CHART_DIRS = [
  'img/simboli-bianchi', 'img/simboli/case', 'img/simboli/elementi-celesti',
  'img/simboli/elementi', 'img/simboli/segni', 'img/grafici', 'img/textures',
];
const FILE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif']);
const sorted = set => [...set].sort((a, b) => a.localeCompare(b, 'en'));

function parseFile(file) {
  if (!existsSync(file)) throw new Error('Required TypeScript source not found: ' + file);
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}
function propertyName(node) {
  return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : null;
}
function literal(node) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
}
// Parse active TypeScript AST nodes, not comments or historical example URLs.
export function extractStaticReferences(skinsTs, imagesTs) {
  const refs = [];
  function visitSkins(node) {
    if (ts.isPropertyAssignment(node) && ['texture', 'imgRisuonatoreSolare'].includes(propertyName(node.name))) {
      const value = literal(node.initializer);
      if (value) refs.push({ reference: value, origin: 'skin' });
    }
    ts.forEachChild(node, visitSkins);
  }
  ts.forEachChild(skinsTs, visitSkins);
  function visitImages(node) {
    if (ts.isPropertyDeclaration(node) && propertyName(node.name) === 'preloadArraySimboli'
        && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
      for (const item of node.initializer.elements) {
        const value = literal(item);
        if (value) refs.push({ reference: value, origin: 'preload' });
      }
    }
    ts.forEachChild(node, visitImages);
  }
  ts.forEachChild(imagesTs, visitImages);
  return refs;
}
export function assetPath(reference) {
  if (typeof reference !== 'string' || !reference) throw new Error('Empty asset reference');
  let ref = reference.replace(/\\/g, '/');
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//'))
    throw new Error('External/nonlocal chart asset: ' + reference);
  ref = ref.replace(/^(?:\.\.\/|\.\/)+(?=assets\/)/, '');
  ref = ref.replace(/^\/+/, '').replace(/^assets\//, '');
  if (!ref.startsWith('img/') && !ref.startsWith('fonts/')) ref = 'img/' + ref;
  return validatePath(ref);
}
function allFiles(root, directory, out) {
  const base = join(root, ...directory.split('/'));
  if (!existsSync(base)) return;
  if (lstatSync(base).isSymbolicLink()) throw new Error('Symlink forbidden: ' + directory);
  if (!lstatSync(base).isDirectory()) throw new Error('Not an asset directory: ' + directory);
  for (const ent of readdirSync(base, { withFileTypes: true })) {
    const ref = directory + '/' + ent.name;
    if (ent.isSymbolicLink()) throw new Error('Symlink forbidden: ' + ref);
    if (ent.isDirectory()) allFiles(root, ref, out);
    else if (ent.isFile() && FILE_EXT.has(extname(ref).toLowerCase())) out.add(validatePath(ref));
  }
}
// Conservative candidate selection, with blocking diagnostics for missing literal artwork.
export function deriveSelection(assetsRoot, sourceRoot = DEFAULT_SOURCE) {
  const root = resolve(assetsRoot);
  const skins = parseFile(join(sourceRoot, 'lib/renderers/@skin-manager.ts'));
  const images = parseFile(join(sourceRoot, 'lib/renderers/gestore-immagini.ts'));
  const discovered = new Set();
  for (const folder of CHART_DIRS) allFiles(root, folder, discovered);
  const refs = extractStaticReferences(skins, images);
  const referenced = new Set();
  const unresolved = [];
  for (const { reference, origin } of refs) {
    let path;
    try { path = assetPath(reference); } catch (err) {
      unresolved.push({ reference, origin, problem: err.message });
      continue;
    }
    const local = join(root, ...path.split('/'));
    if (!existsSync(local) || !lstatSync(local).isFile() || lstatSync(local).isSymbolicLink())
      unresolved.push({ reference, origin, expected: path, problem: 'Missing or non-regular host asset' });
    else referenced.add(path);
  }
  const files = sorted(new Set([...discovered, ...referenced]));
  const report = {
    schemaVersion: 1,
    scope: 'Conservative chart families, not a device-minimal selection',
    totalLiteralReferences: refs.length,
    uniqueLiteralReferences: new Set(refs.map(r => r.reference)).size,
    discoveredFamilyFiles: discovered.size,
    selectedFiles: files.length,
    unresolved,
    knownLimits: [
      'Dynamic filenames using runtime planet names and skins are not fully enumerable from static literals.',
      'The candidate includes all artwork in known chart folders; it can exceed an individual device requirement.',
      'Other VirgoStars frontend page assets and redistribution rights are not examined.',
      'No asset files are copied; only paths and diagnostics are returned.',
    ],
  };
  return { files, report };
}

function cli(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith('--') || !argv[i + 1] || Object.hasOwn(args, key))
      throw new Error('Usage: --root <VirgoStars/public/assets> --out <selection.json> --report <report.json> [--source <src>]');
    args[key] = argv[i + 1];
  }
  if (!args['--root'] || !args['--out'] || !args['--report'])
    throw new Error('Missing --root, --out or --report');
  const { files, report } = deriveSelection(args['--root'], args['--source'] || DEFAULT_SOURCE);
  writeFileSync(args['--report'], JSON.stringify(report, null, 2) + '\n');
  if (report.unresolved.length) {
    console.error('Blocked: ' + report.unresolved.length + ' unresolved literal references. Details: ' + args['--report']);
    process.exitCode = 2;
    return;
  }
  writeFileSync(args['--out'], JSON.stringify(files, null, 2) + '\n');
  console.log('Selected ' + files.length + ' paths; ' + report.uniqueLiteralReferences + ' unique literals. No files copied.');
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try { cli(process.argv.slice(2)); } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
