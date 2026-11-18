import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  stdin: {
    contents: [
      "export { SegniRender } from './src/lib/renderers/moduli/segni.renderer';",
      "export { CaseRender } from './src/lib/renderers/moduli/case.renderer';",
      "export { OggettiSempliciRender } from './src/lib/renderers/oggetti-semplici.renderer';",
      "export { SkinManager } from './src/lib/renderers/@skin-manager';",
      "export * as THREE from 'three';",
    ].join('\n'),
    resolveDir: process.cwd(), sourcefile: 'virgostars-skin-harness.ts', loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022',
});
const { SegniRender, CaseRender, OggettiSempliciRender, SkinManager, THREE } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

async function zodiac(skin, mostraTransiti = false, extra = {}) {
  const original = OggettiSempliciRender.getImg;
  OggettiSempliciRender.setDimensioniCanvas({x: 1200, y: 1200});
  OggettiSempliciRender.getImg = async () => new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial(),
  );
  try {
    return await SegniRender.getAnelloSegni(20, 1, 3.9, 4.57, false, false, false,
      {mostraTransiti, ...extra, settaggi: {skin_id: skin}});
  } finally {
    OggettiSempliciRender.getImg = original;
  }
}

test('decades retain only ten-degree ticks and give the main signs a separate outer band', async () => {
  const ordinary = await zodiac('virgostars');
  const decades = await zodiac('virgostars', false, {mostraDecadi:true});
  const both = await zodiac('virgostars', false, {mostraDecadi:true,mostraDecani:true});
  const ticks = group => group.children.filter(c => Number.isInteger(c.userData.zodiacTickDegree));
  const main = group => group.children.find(c => c.userData.zodiacMainSign === 0);
  assert.equal(ticks(ordinary).length,72);
  for (const group of [decades,both]) {
    assert.equal(ticks(group).length,36);
    assert.ok(ticks(group).every(tick => tick.userData.zodiacTickDegree % 10 === 0));
    assert.ok(main(group).scale.x < main(ordinary).scale.x);
    assert.ok(main(group).position.length() > main(ordinary).position.length());
    const decade = group.children.flatMap(c => c.children).find(c => c.userData.decadeIndex === 0);
    assert.ok(decade.position.length() < main(group).position.length());
  }
});

test('terms and house numbers occupy separate halves of the house band', async () => {
  const original = OggettiSempliciRender.getImg;
  OggettiSempliciRender.setDimensioniCanvas({x:1200,y:1200});
  OggettiSempliciRender.getImg = async () => new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial());
  try {
    const house = {ascendant:37, house:Array.from({length:12},(_,i)=>(37+i*30)%360)};
    const options = {mostraTermini:true, settaggi:{skin_id:'virgostars',domificazione_selezionata:'egizia'}};
    const group = await CaseRender.getAnelloCaseCartaAstrale({egizia:house},0,1,'',options,2,3,4.5,2.7,false);
    const terms = [], numbers = [], boundaries = [];
    group.traverse(object => {
      if (Number.isInteger(object.userData.regoloTermine)) terms.push(object);
      if (Number.isInteger(object.userData.houseNumber)) numbers.push(object);
      if (Number.isInteger(object.userData.termineBoundary)) boundaries.push(object);
    });
    assert.equal(terms.length,60);
    assert.equal(numbers.length,12);
    assert.equal(boundaries.length,60);
    assert.ok(terms.every(term => Math.abs(term.position.length()-1.375) < 1e-9));
    assert.ok(numbers.every(number => Math.abs(number.position.length()-1.125) < 1e-9));
    assert.ok(terms.every(term => term.position.length() < 1.5));
    for (let i = 0; i < 60; i++) {
      const start = (90 - house.ascendant + i * 6) * Math.PI / 180;
      assert.ok(Math.abs(Math.sin(boundaries[i].rotation.z) - Math.sin(start)) < 1e-9);
      assert.ok(Math.abs(Math.cos(boundaries[i].rotation.z) - Math.cos(start)) < 1e-9);
      assert.ok(Math.abs(terms[i].position.x + 1.375 * Math.sin(start + Math.PI / 60)) < 1e-9);
      assert.ok(Math.abs(terms[i].position.y - 1.375 * Math.cos(start + Math.PI / 60)) < 1e-9);
    }
  } finally { OggettiSempliciRender.getImg = original; }
});

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
