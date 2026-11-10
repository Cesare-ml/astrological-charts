/**
 * Example: node examples/node/example.mjs
 * JPEG:    node examples/node/example.mjs --jpg
 *
 * Values are invented sample positions, NOT real ephemerides.
 * Copyright (c) 2026 Cesare-ml (VirgoStars project). CPAL-1.0.
 */
import { renderChart } from '../../node/index.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const computedLongitudes = {
  Sun: 15, Moon: 75, Mercury: 42, Venus: 103, Mars: 135,
  Jupiter: 195, Saturn: 255, Uranus: 278, Neptune: 308, Pluto: 338,
};
const natal = {
  datetime: '2000-01-01T12:00:00Z',
  ascendant: 20,
  midheaven: 290,
  houseCusps: Array.from({ length: 12 }, (_, index) => (20 + index * 30) % 360),
  planets: Object.fromEntries(Object.entries(computedLongitudes).map(([name, longitude]) => [
    name, { longitude, latitude: 0, longitudeSpeed: 0, latitudeSpeed: 0, declination: 0 },
  ])),
};
// The external mode is explicit and uses ONLY the owner-authorized
// adjacent asset checkout. It does not copy or publish these images.
const approved = process.argv.includes('--approved-assets');
const format = process.argv.includes('--jpg') ? 'jpg' : 'png';
const output = approved ? `.local/node-example-approved.${format}` : `.local/node-example.${format}`;
const exampleDir = dirname(fileURLToPath(import.meta.url));
const assets = approved ? {
  assetRoot: resolve(exampleDir, '../../../astrological-assets/public/assets'),
  assetManifest: resolve(exampleDir, '../../../astrological-assets/manifests/approved-assets.json'),
} : {};
const path = await renderChart({ schemaVersion: 1, natal, mode: 'natal' }, output,
  { skin: 'light', ...assets });
console.log('Chart image created at:', path);
console.log('All sample positions are illustrative, not astronomical calculations.');
