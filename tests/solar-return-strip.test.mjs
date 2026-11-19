import {test} from 'node:test';
import assert from 'node:assert/strict';
import {solarReturnStripPosition,solarReturnAxisColor,solarReturnSignColor} from '../src/lib/components/solar-return-strip-layout.ts';

test('return strip is anchored to the radix cusp and wraps through zero', () => {
  assert.equal(solarReturnStripPosition(350,350),0);
  assert.ok(Math.abs(solarReturnStripPosition(8,350)-5)<1e-10);
  assert.equal(solarReturnStripPosition(170,350),50);
  assert.equal(solarReturnStripPosition(-10,350),0);
});

test('axis and sign colours match the website, including zodiac wrap and precedence', () => {
  assert.equal(solarReturnAxisColor('ASC'),'#ed6e00');
  assert.equal(solarReturnAxisColor('MC'),'#6600a1');
  assert.equal(solarReturnAxisColor('IC'),'#a59acf');
  assert.equal(solarReturnAxisColor('DS'),'#1ea45e');
  assert.equal(solarReturnSignColor(11,[{name:'ASC',longitude:-1}]),'#ed6e00');
  assert.equal(solarReturnSignColor(0,[{name:'ASC',longitude:2},{name:'MC',longitude:3}]),'#6600a1');
  assert.equal(solarReturnSignColor(1,[]),'transparent');
});
