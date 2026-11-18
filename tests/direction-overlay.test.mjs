import test from 'node:test';
import assert from 'node:assert/strict';
import {directionOverlayOffsets} from '../src/lib/renderers/moduli/direction-overlay.ts';
test('primary direction applies both chart and symbolic-axis offsets', () => {
  assert.deepEqual(directionOverlayOffsets(20, 25, 'primarieSemplificate', 7.5), {geometry:-5, symbolicAxis:7.5});
  assert.deepEqual(directionOverlayOffsets(20, 20, 'simboliche', 7.5), {geometry:0, symbolicAxis:0});
});
test('invalid geometry or unknown mode is rejected', () => {
  assert.throws(() => directionOverlayOffsets(20, NaN, 'simboliche', 5));
  assert.throws(() => directionOverlayOffsets(20, 30, 'other', 5));
});
