/* Real-browser smoke test for the Node.js/Python render bridge.
 * Copyright (c) 2026 Cesare-ml (VirgoStars project). CPAL-1.0.
 *
 * Explicit opt-in only: requires npm ci, Chrome/Chromium and WebGL.
 * Uses original locally generated checkerboard assets and INVENTED
 * celestial positions, never real people's birth records.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import sharp from 'sharp';
import { renderChart } from '../node/index.mjs';

const natal = {
  datetime: '2000-01-01T12:00:00Z',
  ascendant: 20,
  midheaven: 290,
  houseCusps: Array.from({ length: 12 }, (_, i) => (20 + i * 30) % 360),
  planets: Object.fromEntries([
    ['Sun',15], ['Moon',75], ['Mercury',42], ['Venus',103], ['Mars',135],
    ['Jupiter',195], ['Saturn',255], ['Uranus',278], ['Neptune',308],
    ['Pluto',338],
  ].map(([name, longitude], index) => [name, {
    longitude,
    // Exercise exact-zero latitude alongside positive and negative inputs.
    latitude: index % 3 === 0 ? 0 : index % 2 === 0 ? 2.25 : -1.5,
    longitudeSpeed: 0.1, latitudeSpeed: 0, declination: 0,
  }])),
};
const shifted = (offset) => ({
  ...natal,
  planets: Object.fromEntries(Object.entries(natal.planets)
    .map(([name, coordinates]) => [name, {
      ...coordinates, longitude: (coordinates.longitude + offset) % 360,
    }])),
});
const payload = {
  schemaVersion: 1,
  natal,
  transits: shifted(24),
  synastry: shifted(71),
};

// Run manually with npm run test:render-bridge. This is intentionally
// not part of preflight: every case launches real WebGL and local servers.
test('Node bridge renders four distinct chart modes with genuine PNG/JPEG output',
  { timeout: 900_000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'virgostars-real-bridge-'));
    try {
      // All modes must render the requested, completed scene, not reuse
      // a previous chart or silently replace absent secondary datasets.
      // At least one light/skin pair is comparable without JPEG artifacts.
      const cases = [
        { mode: 'natal', skin: 'light', format: 'png' },
        { mode: 'transits', skin: 'dark', format: 'jpg' },
        { mode: 'synastry', skin: 'light', format: 'png' },
        { mode: 'latitude', skin: 'dark', format: 'png' },
      ];
      const rendered = new Map();
      for (const { mode, skin, format } of cases) {
        const path = join(directory, `chart-${mode}-${skin}.${format}`);
        assert.equal(await renderChart(payload, path, {
          mode, skin, timeoutMs: 180_000,
        }), path);
        assert.ok((await stat(path)).size > 500,
          `${mode}/${skin}: output is suspiciously small`);
        const info = await sharp(path).metadata();
        assert.equal(info.format, format === 'png' ? 'png' : 'jpeg');
        assert.equal(info.width, 1600);
        assert.equal(info.height, 1600);
        const statistics = await sharp(path).stats();
        assert.ok(statistics.channels.some(channel => channel.stdev > 5),
          `${mode}/${skin}: the image appears blank`);
        // Normalize file formats to decoded, resized RGB pixels; this
        // confirms light-mode natal and synastry do not become the same
        // image. JPEG is not compared pixel-perfectly to PNG.
        const rgb = await sharp(path).resize(160, 160).removeAlpha().raw().toBuffer();
        rendered.set(mode, createHash('sha256').update(rgb).digest('hex'));
        console.log(`Verified ${mode}/${skin}: ${info.width}x${info.height} ${info.format}`);
      }
      assert.notEqual(rendered.get('natal'), rendered.get('synastry'),
        'natal/light and synastry/light exported identical pixels; secondary chart may be ignored');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
