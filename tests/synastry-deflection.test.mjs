import test from 'node:test';
import assert from 'node:assert/strict';
import {synastryDeflectionOffset} from '../src/lib/renderers/moduli/synastry-deflection.ts';

test('Regolo deflects the partner ascendant onto the reference house axis', () => {
  for (const [reference, partner] of [[10,350], [350,10], [0,0], [128.5,44.25]]) {
    for (let house = 1; house <= 12; house++) {
      const offset = synastryDeflectionOffset(reference, partner, house);
      assert.equal(offset, (house - 1) * 30 + reference - partner);
      assert.equal(reference - offset, partner - (house - 1) * 30);
    }
  }
});

test('invalid deflection settings do not produce an unlabelled ordinary chart', () => {
  for (const values of [[NaN, 0, 1], [0, Infinity, 1], [0, 0, 0], [0, 0, 13], [0, 0, 1.5]])
    assert.throws(() => synastryDeflectionOffset(...values), RangeError);
});
