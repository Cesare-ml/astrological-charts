#!/usr/bin/env node
// Locally generated test imagery only. Never reads or copies production artwork.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { generateSyntheticPack, makeSyntheticPng } from './generate-synthetic-pack.mjs';

const skins = ['dark', 'dark-bn', 'light', 'light-bn', 'sun', 'astrolabio', 'astrolabio-girasole'];
const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

export async function generateDemoPack(outputDir) {
  const result = generateSyntheticPack(outputDir);
  const additional = [
    'img/risuonatore-solare-vetro-satinato.png',
    'img/risuonatore-solare-vetro-giallo-satinato.png',
    'img/risuonatore-solare-bianco.png',
    'img/textures/texture-oro-1.jpg',
    'img/textures/texture-oro-2.jpg',
    'img/textures/texture-oro-3.webp',
    ...skins.flatMap(skin => bodies.flatMap(body => [
      `img/simboli/elementi-celesti/${skin}/cerchio/${body}.png`,
      `img/simboli/elementi-celesti/${skin}/cerchio/anello/${body}.png`,
    ])),
    ...skins.flatMap(skin => ['', 'bianco/'].flatMap(color =>
      Array.from({length: 12}, (_, i) => `img/simboli/case/${skin}/725x460/${color}${String(i + 1).padStart(2, '0')}.png`))),
  ];
  for (const path of additional) {
    const png = makeSyntheticPng(path);
    const bytes = path.endsWith('.jpg') ? await sharp(png).jpeg().toBuffer()
      : path.endsWith('.webp') ? await sharp(png).webp().toBuffer() : png;
    const target = join(result.root, ...path.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes, { flag: 'wx' });
    result.manifest.assets.push({
      path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
      rightsHolder: 'Astrological Charts synthetic test fixture',
      permissionBasis: 'Original synthetic checkerboard data generated locally; not VirgoStars artwork',
      approvalEvidence: 'scripts/generate-demo-pack.mjs (automatically generated development fixture)',
    });
  }
  result.manifest.assets.sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  writeFileSync(result.manifestPath, JSON.stringify(result.manifest, null, 2) + '\n');
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  if (process.argv.length !== 4 || process.argv[2] !== '--out') {
    console.error('Usage: node scripts/generate-demo-pack.mjs --out .local/demo-pack');
    process.exitCode = 1;
  } else {
    try {
      const result = await generateDemoPack(process.argv[3]);
      console.log(`Created ${result.manifest.assets.length} synthetic test assets. Manifest: ${result.manifestPath}`);
    } catch (error) {
      console.error('DEMO PACK ERROR:', error.message);
      process.exitCode = 1;
    }
  }
}
