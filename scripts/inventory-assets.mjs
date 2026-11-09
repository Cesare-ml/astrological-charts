import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const relevant = /(?:assets\/|assetsImgRef|fontFilename|\.(?:png|jpe?g|webp|svg|woff2?|ttf)|\.getImg\(|\.loadAsync\(|imgRisuonatoreSolare|texture\s*:)/i;
for (const path of scannedFiles) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  let insideBlockComment = false;
  for (let i = 0; i < lines.length; i++) {
    const source = lines[i].trim();
    if (source.startsWith('/*')) insideBlockComment = true;
    if (insideBlockComment) {
      if (source.includes('*/')) insideBlockComment = false;
      continue;
    }
    if (!source || source.startsWith('//') || source.startsWith('*')) continue;
    const beforeLineComment = source.split(/\s+\/\//)[0];
    if (!relevant.test(beforeLineComment)) continue;
    rows.push({
      file: relative(root, path).split(sep).join('/'),
      line: i + 1,
      expression: beforeLineComment.slice(0, 220),
      kind: beforeLineComment.includes('${') || /\+\s*(?:opzioni|nome|pianeta|img|String|i\b)/.test(beforeLineComment) ? 'dynamic' : 'reference',
    });
  }
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
