import {test} from 'node:test';
import assert from 'node:assert/strict';
import {solarReturnStripPosition} from '../src/lib/components/solar-return-strip-layout.ts';

test('return strip is anchored to the radix cusp and wraps through zero', () => {
  assert.equal(solarReturnStripPosition(350,350),0);
  assert.ok(Math.abs(solarReturnStripPosition(8,350)-5)<1e-10);
  assert.equal(solarReturnStripPosition(170,350),50);
  assert.equal(solarReturnStripPosition(-10,350),0);
});
