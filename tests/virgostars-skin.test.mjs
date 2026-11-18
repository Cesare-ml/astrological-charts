import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  stdin: {
    contents: [
      "export { SegniRender } from './src/lib/renderers/moduli/segni.renderer';",
      "export { OggettiSempliciRender } from './src/lib/renderers/oggetti-semplici.renderer';",
      "export { SkinManager } from './src/lib/renderers/@skin-manager';",
      "export * as THREE from 'three';",
    ].join('\n'),
    resolveDir: process.cwd(), sourcefile: 'virgostars-skin-harness.ts', loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022',
});
const { SegniRender, OggettiSempliciRender, SkinManager, THREE } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

async function zodiac(skin, mostraTransiti = false) {
  const original = OggettiSempliciRender.getImg;
  OggettiSempliciRender.setDimensioniCanvas({x: 1200, y: 1200});
  OggettiSempliciRender.getImg = async () => new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial(),
  );
  try {
    return await SegniRender.getAnelloSegni(20, 1, 3.9, 4.57, false, false, false,
      {mostraTransiti, settaggi: {skin_id: skin}});
  } finally {
    OggettiSempliciRender.getImg = original;
  }
}

test('official VirgoStars has twelve pastel zodiac sectors, without bundling asset images', async () => {
  const official = await zodiac('virgostars');
  const sectors = official.children.filter(child => Number.isInteger(child.userData.zodiacSector));
  assert.equal(sectors.length, 12);
  assert.deepEqual(sectors.map(sector => sector.material.color.getHexString()),
    ['ffebe9','eaf5e3','fff1dc','f0eafd','ffebe9','eaf5e3',
      'fff1dc','f0eafd','ffebe9','eaf5e3','fff1dc','f0eafd']);
  assert.ok(sectors.every(sector => sector.position.z < 0), 'pastel panels must stay behind the glyphs');
  const legacy = await zodiac('light');
  assert.equal(legacy.children.filter(child => Number.isInteger(child.userData.zodiacSector)).length, 0,
    'changing the new official look must not recolor the original skins');
  assert.equal(SkinManager.getAxisColors('light').asc, '#cb5c12');
  assert.equal(SkinManager.getAxisColors('virgostars').asc, '#e65b12');
  assert.ok(SkinManager.skins.virgostars.cerchioAspetti.imgRisuonatoreSolareOpacity < 0.08,
    'the official center motif should be as delicate as the approved reference');
});

test('dark skin headings are white and monochrome skins use monochrome axis strokes', () => {
  const dark = SkinManager.getAxisColors('dark');
  const darkMono = SkinManager.getAxisColors('dark-bn');
  const lightMono = SkinManager.getAxisColors('light-bn');
  assert.equal(dark.testo, '#ffffff', 'dark axis captions must contrast with the charcoal background');
  assert.equal(dark.asc, '#cb5c12', 'ordinary dark skin keeps its coloured axis arrows');
  for (const key of ['asc', 'ds', 'mc', 'ic', 'testo', 'motoMC']) {
    assert.equal(darkMono[key], '#ffffff', `dark B/N ${key} must be pure white`);
    assert.equal(lightMono[key], '#000000', `light B/N ${key} must be pure black`);
  }
});

test('only transit charts draw the external ruler, for any skin', async () => {
  const scale = group => group.children.find(child => child.name === 'zodiac-degree-scale');
  for (const skin of ['virgostars', 'dark', 'light']) {
    assert.equal(scale(await zodiac(skin)), undefined,
      `${skin}: natal charts must not show the transit-only ruler`);
  }

  const official = await zodiac('virgostars', true);
  const other = await zodiac('dark', true);
  assert.ok(scale(official)?.isLineSegments && scale(other)?.isLineSegments);
  assert.equal(scale(official).userData.tickCount, 360);
  assert.equal(scale(official).geometry.attributes.position.count, 720);
  assert.deepEqual([...scale(official).geometry.attributes.position.array],
    [...scale(other).geometry.attributes.position.array],
    'the zodiac ruler must never be tied to the color/skin');

  const coords = scale(official).geometry.attributes.position;
  const pairLength = index => {
    const start = new THREE.Vector3().fromBufferAttribute(coords, index * 2);
    const end = new THREE.Vector3().fromBufferAttribute(coords, index * 2 + 1);
    return start.distanceTo(end);
  };
  assert.ok(pairLength(0) > pairLength(5) && pairLength(5) > pairLength(1),
    '10°, 5° and 1° marks must be hierarchically legible');
});

test('synastry zodiac does not add a transit ruler unless transits are enabled', async () => {
  const original = OggettiSempliciRender.getImg;
  OggettiSempliciRender.setDimensioniCanvas({x: 1200, y: 1200});
  OggettiSempliciRender.getImg = async () => new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial(),
  );
  try {
    const render = async mostraTransiti => SegniRender.getAnelloSegniSinastria(
      20, 1.4, 2.0, false,
      {opzioni: {mostraTransiti, settaggi: {skin_id: 'virgostars'}}},
    );
    const ruler = group => group.children.find(child => child.name === 'zodiac-degree-scale');
    assert.equal(ruler(await render(false)), undefined);
    assert.equal(ruler(await render(true))?.userData.tickCount, 360);
  } finally {
    OggettiSempliciRender.getImg = original;
  }
});
