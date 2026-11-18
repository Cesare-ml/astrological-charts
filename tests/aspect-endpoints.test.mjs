import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  stdin: {
    contents: [
      "export { AspettiRender } from './src/lib/renderers/moduli/aspetti.renderer';",
      "export { OggettiSempliciRender } from './src/lib/renderers/oggetti-semplici.renderer';",
    ].join('\n'),
    resolveDir: process.cwd(), sourcefile: 'aspect-endpoints-harness.ts', loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022',
});
const { AspettiRender, OggettiSempliciRender } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('aspect endpoint dots show the true astronomical degree and source planet', () => {
  OggettiSempliciRender.setDimensioniCanvas({x: 1200, y: 1200});
  const nodes = [
    {name: 'Sun', longitude: 358.4, y: 1.2},
    {name: 'Moon', longitude: 58.4, y: 1.2},
  ];
  const group = AspettiRender.renderArchi(20, nodes, {60: [[0, 1]]}, ['sestile'], {}, 2.4, false);
  const dots = group.children.filter(child => child.userData.aspectEndpoint);
  assert.deepEqual(dots.map(dot => dot.userData.aspectEndpoint), ['Sun', 'Moon']);
  assert.deepEqual(dots.map(dot => dot.userData.trueLongitude), [358.4, 58.4]);
  for (let i = 0; i < dots.length; i++) {
    const angle = (90 - 20 + nodes[i].longitude) * Math.PI / 180;
    assert.ok(Math.abs(dots[i].position.x + Math.sin(angle) * 1.2) < 1e-8);
    assert.ok(Math.abs(dots[i].position.y - Math.cos(angle) * 1.2) < 1e-8);
    assert.equal(dots[i].geometry.parameters.radius, 0.017);
    assert.equal(dots[i].material.color.getHexString(), '9e02ff');
  }
});
