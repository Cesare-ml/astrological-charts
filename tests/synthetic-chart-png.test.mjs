import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { inspectSyntheticChartPng } from '../scripts/inspect-synthetic-chart-png.mjs';

const width = 48;
const height = 48;
const asDataUrl = png => 'data:image/png;base64,' + png.toString('base64');

function colorfulRgb() {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      data[i] = (x * 7) % 256;
      data[i + 1] = (y * 11) % 256;
      data[i + 2] = ((x + y) * 13) % 256;
    }
  }
  return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

test('accepts visible non-uniform chart pixels and returns deterministic digest', async () => {
  const uri = asDataUrl(await colorfulRgb());
  const a = await inspectSyntheticChartPng(uri, { width, height });
  const b = await inspectSyntheticChartPng(uri, { width, height });
  assert.equal(a.width, width);
  assert.equal(a.height, height);
  assert.ok(a.sampledVisibleColors > 10);
  assert.match(a.pngSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(a, b);
});

test('rejects an all-white but syntactically valid PNG', async () => {
  const png = await sharp({ create: { width, height, channels: 3, background: '#ffffff' } }).png().toBuffer();
  await assert.rejects(inspectSyntheticChartPng(asDataUrl(png), { width, height }), /visually uniform/);
});

test('rejects varied hidden RGB beneath completely transparent pixels', async () => {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = (i * 3) % 256;
    data[i * 4 + 1] = (i * 7) % 256;
    data[i * 4 + 2] = (i * 11) % 256;
    data[i * 4 + 3] = 0;
  }
  const png = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  await assert.rejects(inspectSyntheticChartPng(asDataUrl(png), { width, height }), /visually uniform/);
});

test('rejects otherwise valid PNG with unexpected dimensions', async () => {
  const png = await colorfulRgb();
  await assert.rejects(inspectSyntheticChartPng(asDataUrl(png), { width: 1600, height: 1600 }), /dimensions/);
});

test('rejects unsupported, malformed or forged PNG data URL', async () => {
  await assert.rejects(inspectSyntheticChartPng('data:image/jpeg;base64,AAAA', { width, height }), /PNG base64/);
  await assert.rejects(inspectSyntheticChartPng('data:image/png;base64,!@#', { width, height }), /Malformed/);
  await assert.rejects(inspectSyntheticChartPng('data:image/png;base64,' + Buffer.alloc(40).toString('base64'), { width, height }), /signature/);
});
