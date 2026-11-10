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
  ].map(([name, longitude]) => [name, {
    longitude, latitude: 0, longitudeSpeed: 0.1, latitudeSpeed: 0,
    declination: 0,
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
test('external Node chart JSON produces genuine nonblank PNG/JPEG in selected modes',
  { timeout: 480_000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'virgostars-real-bridge-'));
    try {
      const cases = [
        { mode: 'natal', skin: 'light', format: 'png' },
        { mode: 'transits', skin: 'dark', format: 'jpg' },
      ];
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
        console.log(`Verified ${mode}/${skin}: ${info.width}x${info.height} ${info.format}`);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
