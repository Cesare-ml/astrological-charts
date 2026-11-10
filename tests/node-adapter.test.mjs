/* Node adapter contract tests — no Chromium, Angular, or private data.
 * Copyright (c) 2026 Cesare-ml (VirgoStars project); CPAL-1.0.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { renderChart, renderChartFile, buildRenderArgs } from '../node/index.mjs';

const SAMPLE_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLefgAAAABJRU5ErkJggg==';
const payload = {
  schemaVersion: 1,
  natal: { planets: { Sun: { longitude: 42.25, latitude: 0 } } },
};

test('Node argument formatting preserves mode, skin and image path', () => {
  assert.deepEqual(
    buildRenderArgs('chart.json', 'out.png', { mode: 'transits', skin: 'light' }),
    ['--input', resolve('chart.json'), '--output', resolve('out.png'),
      '--mode', 'transits', '--skin', 'light']);
  assert.throws(() => buildRenderArgs('data.json', 'test.svg'), /png, .jpg or .jpeg/);
  assert.throws(() => buildRenderArgs('data.json', 'test.png', { mode: 'not-a-mode' }), /Invalid mode/);
});

test('Node API rejects unknown schema, nonfinite numbers and unsafe timeouts', async () => {
  await assert.rejects(renderChart({ schemaVersion: 2 }, 'invalid.png'), /schemaVersion: 1/);
  await assert.rejects(renderChart({ schemaVersion: 1, natal: { ascendant: NaN } },
    'invalid.png'), /NaN or Infinity/);
  await assert.rejects(renderChart({ schemaVersion: 1, natal: { ascendant: Infinity } },
    'invalid.png'), /NaN or Infinity/);
  await assert.rejects(renderChart(payload, 'invalid.png', { timeoutMs: -1 }), /timeoutMs/);
  await assert.rejects(renderChart(payload, 'invalid.png', { timeoutMs: 999999 }), /timeoutMs/);
});

test('Node.js forwards precomputed JSON and publishes a staged PNG only after a verified result', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'virgostars-node-test-'));
  try {
    const mock = join(dir, 'mock-renderer.mjs');
    const record = join(dir, 'request.json');
    const output = join(dir, 'out.png');
    await writeFile(mock, `
      import {readFile,writeFile} from 'node:fs/promises';
      const argv=process.argv.slice(2);
      const option=name=>argv[argv.indexOf(name)+1];
      const data=JSON.parse(await readFile(option('--input'),'utf8'));
      await writeFile(option('--output'),Buffer.from(${JSON.stringify(SAMPLE_PNG)},'base64'));
      await writeFile(${JSON.stringify(record)},JSON.stringify({
        data, mode:option('--mode'), skin:option('--skin'), source:option('--input'),
      }));
    `);
    const result = await renderChart(payload, output, {
      mode: 'natal', skin: 'light', rendererScript: mock,
    });
    assert.equal(result, resolve(output));
    assert.deepEqual((await readFile(output)).subarray(0, 8),
      Buffer.from('89504e470d0a1a0a', 'hex'));
    const recorded = JSON.parse(await readFile(record, 'utf8'));
    assert.deepEqual(recorded.data, payload);
    assert.equal(recorded.mode, 'natal');
    assert.equal(recorded.skin, 'light');
    await assert.rejects(access(recorded.source), /ENOENT/,
      'temporary input should be removed');
    assert.ok(!(await readdir(dir)).some(name=>name.startsWith('.virgostars-chart-')),
      'staging directories should be removed');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('zero-output success and wrong-format output do not overwrite previous image', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'virgostars-node-bad-'));
  try {
    const output = join(dir, 'existing.png');
    const input = join(dir, 'input.json');
    const empty = join(dir, 'no-output.mjs');
    const bad = join(dir, 'invalid-output.mjs');
    await writeFile(input, JSON.stringify(payload));
    await writeFile(output, 'KEEP THIS USER IMAGE');
    await writeFile(empty, '// deliberately no output');
    await writeFile(bad, `
      import {writeFile} from 'node:fs/promises';
      const index=process.argv.indexOf('--output');
      await writeFile(process.argv[index+1],'x'.repeat(64));
    `);
    await assert.rejects(renderChartFile(input, output, { rendererScript: empty }),
      /without creating an image file/);
    await assert.rejects(renderChartFile(input, output, { rendererScript: bad }),
      /did not produce the requested PNG\/JPEG format/);
    assert.equal(await readFile(output, 'utf8'), 'KEEP THIS USER IMAGE');
    assert.ok(!(await readdir(dir)).some(name=>name.startsWith('.virgostars-chart-')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Node.js caller can bound a nonresponsive render process', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'virgostars-node-timeout-'));
  try {
    const input = join(dir, 'input.json');
    const output = join(dir, 'out.png');
    const slow = join(dir, 'slow.mjs');
    await writeFile(input, JSON.stringify(payload));
    await writeFile(slow, 'await new Promise(resolve=>setTimeout(resolve,5000));');
    await assert.rejects(
      renderChartFile(input, output, { rendererScript: slow, timeoutMs: 150 }),
      error => error?.killed === true || error?.signal === 'SIGTERM' ||
        error?.code === 'ETIMEDOUT',
    );
    await assert.rejects(access(output), /ENOENT/);
    assert.ok(!(await readdir(dir)).some(name=>name.startsWith('.virgostars-chart-')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
