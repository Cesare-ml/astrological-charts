import test from 'node:test';
import assert from 'node:assert/strict';
import { pixelDifference } from './helpers/axis-canvas-pixels.mjs';

function image(width = 10, height = 10, channels = 3) {
  return {
    info: { width, height, channels },
    data: new Uint8Array(width * height * channels)
  };
}
function paint(frame, x, y, values) {
  const at = (y * frame.info.width + x) * frame.info.channels;
  values.forEach((v, index) => { frame.data[at + index] = v; });
}

test('identical idle frames produce no change in the chart or central area', () => {
  const a = image(), b = image();
  assert.deepEqual(pixelDifference(a, b), { changed: 0, centralChanged: 0 });
  paint(b, 5, 5, [12, 0, 0]);
  assert.deepEqual(pixelDifference(a, b), { changed: 0, centralChanged: 0 },
    'The default pixel channel tolerance is 12');
});

test('RGB variations count once per changed pixel; central and edge differ', () => {
  const a = image(), b = image();
  paint(b, 5, 5, [255, 255, 255]); // central
  paint(b, 0, 0, [255, 255, 255]); // outer
  assert.deepEqual(pixelDifference(a, b), { changed: 2, centralChanged: 1 });
  assert.deepEqual(pixelDifference(b, a), { changed: 2, centralChanged: 1 });
  assert.deepEqual(pixelDifference(a, b, 255), { changed: 0, centralChanged: 0 });
});

test('central crop of a 10x10 frame is the deterministic 18–82 percent area', () => {
  const a = image(), b = image();
  paint(b, 1, 1, [200, 0, 0]); // outside 18%
  paint(b, 2, 2, [200, 0, 0]); // inside 18%
  paint(b, 8, 8, [200, 0, 0]); // inside 82% ceil
  paint(b, 9, 9, [200, 0, 0]); // outside
  assert.deepEqual(pixelDifference(a, b), { changed: 4, centralChanged: 2 });
});

test('RGBA screenshots use RGB for comparisons and ignore alpha changes', () => {
  const a = image(10, 10, 4), b = image(10, 10, 4);
  paint(b, 5, 5, [0, 0, 0, 255]);
  assert.deepEqual(pixelDifference(a, b), { changed: 0, centralChanged: 0 });
  paint(b, 5, 5, [30, 0, 0, 255]);
  assert.deepEqual(pixelDifference(a, b), { changed: 1, centralChanged: 1 });
});

test('invalid or different dimensions fail rather than hiding a scene rebuild', () => {
  const valid = image(), bad = image(9, 10);
  assert.throws(() => pixelDifference(valid, bad), /dimensions\/channels changed/);
  assert.throws(() => pixelDifference(valid, image(10,10,4)), /dimensions\/channels changed/);
  assert.throws(() => pixelDifference(null, valid), TypeError);
  assert.throws(() => pixelDifference({ info: { width: 0, height: 10, channels: 3 }, data: [] }, valid), RangeError);
  assert.throws(() => pixelDifference(valid, { info: valid.info, data: [] }), RangeError);
  assert.throws(() => pixelDifference(valid, valid, -1), RangeError);
  assert.throws(() => pixelDifference(valid, valid, NaN), RangeError);
});
