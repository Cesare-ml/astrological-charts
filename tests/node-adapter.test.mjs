/* Node.js adapter contract tests; no Chrome/WebGL/Angular required.
 * Copyright (c) 2026 Cesare-ml (VirgoStars project). CPAL-1.0.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { renderChart, buildRenderArgs } from '../node/index.mjs';

test('Node argument formatting preserves mode, skin and image path', () => {
  assert.deepEqual(
    buildRenderArgs('chart.json', 'out.png', { mode: 'transits', skin: 'light' }),
    ['--input', resolve('chart.json'), '--output', resolve('out.png'),
      '--mode', 'transits', '--skin', 'light']);
  assert.throws(() => buildRenderArgs('data.json', 'test.svg'), /png, .jpg or .jpeg/);
  assert.throws(() => buildRenderArgs('data.json', 'test.png', { mode: 'not-a-mode' }), /Invalid mode/);
});

test('Node API rejects unknown schema and nonfinite numbers without launching Chrome', async () => {
  await assert.rejects(renderChart({ schemaVersion: 2 }, 'invalid.png'), /schemaVersion: 1/);
  await assert.rejects(renderChart({ schemaVersion: 1, natal: { ascendant: NaN } },
    'invalid.png'), /NaN or Infinity/);
  await assert.rejects(renderChart({ schemaVersion: 1, natal: { ascendant: Infinity } },
    'invalid.png'), /NaN or Infinity/);
});

test('Node.js sends precomputed JSON to local render runner and preserves arguments', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'virgostars-node-test-'));
  try {
    const fakeRunner = join(dir, 'mock-renderer.mjs');
    const output = join(dir, 'out.jpg');
    await writeFile(fakeRunner, `
      import {readFile,writeFile} from 'node:fs/promises';
      const argv=process.argv.slice(2);
      const option=name=>argv[argv.indexOf(name)+1];
      const json=JSON.parse(await readFile(option('--input'),'utf8'));
      await writeFile(option('--output'),JSON.stringify({
        json, mode:option('--mode'), skin:option('--skin'),
        source:option('--input'),
      }));
    `);
    const payload = {
      schemaVersion: 1,
      natal: { planets: { Sun: { longitude: 42.25, latitude: 0 } } },
    };
    const result = await renderChart(payload, output, {
      mode: 'natal', skin: 'light', rendererScript: fakeRunner,
    });
    assert.equal(result, resolve(output));
    const rendered = JSON.parse(await readFile(output, 'utf8'));
    assert.deepEqual(rendered.json, payload);
    assert.equal(rendered.mode, 'natal');
    assert.equal(rendered.skin, 'light');
    await assert.rejects(access(rendered.source), /ENOENT/,
      'temporary input should be deleted after the runner exits');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
