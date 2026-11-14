import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectActiveAssetLines } from './active-asset-lines.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = join(root, 'src');
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((ent) => {
    const p = join(dir, ent.name);
    return ent.isDirectory() && ent.name !== '_old' ? walk(p) : ent.isFile() ? [p] : [];
  });
}
const scannedFiles = walk(srcRoot).filter((path) => extname(path) === '.ts');
const rows = [];
for (const path of scannedFiles) {
  const relativePath = relative(root, path).split(sep).join('/');
  rows.push(...collectActiveAssetLines(readFileSync(path, 'utf8'), relativePath));
}
const categories = {
  'zodiac symbols': 'simboli-bianchi/segni/{01..12}.png',
  'house numbers': 'simboli-bianchi/case/{01..12}.png',
  'celestial bodies': 'simboli-bianchi/elementi-celesti/{name}[-r].png',
  'skin-specific body symbols': 'simboli/elementi-celesti/{skin}/cerchio/{name}.png',
  'element symbols/terms': 'simboli/elementi/{skin}/875x605/{0..3}.png',
  'house variants': 'simboli/case/{skin}/725x460/{color}{01..12}.png',
  'backgrounds/rings': 'grafici/{skin}/{layer}.png',
  'resonator images': 'risuonatore-solare-*.png',
  'skin textures': 'assets/img/textures/*.{jpg,webp}',
  'fonts': 'assets/fonts/{fontFilename}',
};
const out = {
  status: 'STATIC REFERENCES ONLY; files/rights/existence NOT validated',
  scannedTypescriptFiles: scannedFiles.length,
  assetRelatedSourceLines: rows.length,
  expectedGroups: categories,
  lines: rows,
};
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`Asset-reference inventory: ${rows.length} candidate source lines across ${scannedFiles.length} TypeScript files.`);
  for (const [label, pattern] of Object.entries(categories)) console.log(`- ${label}: ${pattern}`);
  console.log('No files were copied. Run with --json for all references. This does NOT verify runtime assets or redistribution rights.');
}
