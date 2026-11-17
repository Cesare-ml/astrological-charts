import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  stdin: {
    contents: [
      "export { MarcatoriAssiRender, formatAxisDms, formatAxisDegreeSeconds, formatAxisDegreeTenths, planetaryHourAt } from './src/lib/renderers/moduli/marcatori-assi.renderer';",
      "export { defaultOpzioniGrafico } from './src/lib/models/opzioni-grafico.model';",
      "export { OggettiSempliciRender } from './src/lib/renderers/oggetti-semplici.renderer';",
      "export * as THREE from 'three';",
    ].join('\n'),
    resolveDir: process.cwd(), sourcefile: 'axis-marker-harness.ts', loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022',
});
const { MarcatoriAssiRender, formatAxisDms, formatAxisDegreeSeconds, formatAxisDegreeTenths, planetaryHourAt, defaultOpzioniGrafico, OggettiSempliciRender, THREE } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const hourly = names => names.map((pianeta, i) => ({
  dataora: `2000-01-01 ${String(6 + i).padStart(2, '0')}:00:00`, pianeta,
}));
const hours = {
  dataora: '2000-01-01 07:20:00', alba: '2000-01-01 06:00:00',
  tramonto: '2000-01-01 18:00:00', albaSucc: '2000-01-02 06:00:00',
  dh: {
    diurne: hourly(['Saturn','Jupiter','Mars','Sun','Venus','Mercury','Moon','Saturn','Jupiter','Mars','Sun','Venus']),
    notturne: Array.from({ length: 12 }, (_, i) => ({
      dataora: `${i < 6 ? '2000-01-01' : '2000-01-02'} ${String((18 + i) % 24).padStart(2, '0')}:00:00`,
      pianeta: 'Mercury',
    })),
  },
};

async function makeMarkers(options = {}, overrides = {}) {
  const previousDocument = globalThis.document;
  const originalGetImg = OggettiSempliciRender.getImg;
  const texts = [];
  const fonts = [];
  const assets = [];
  OggettiSempliciRender.getImg = async ref => {
    assets.push(ref);
    return new THREE.Mesh(new THREE.PlaneGeometry(1, 605 / 875), new THREE.MeshBasicMaterial());
  };
  globalThis.document = {
    createElement(name) {
      assert.equal(name, 'canvas');
      return {
        width: 0, height: 0,
        getContext() { return { clearRect() {}, fillText(text) { texts.push(text); fonts.push(this.font); } }; },
      };
    },
  };
  try {
    const opts = { ...structuredClone(defaultOpzioniGrafico), ...options };
    const theme = { orePlanetarie: structuredClone(hours), houses: { egizia: { mcSpeed: 1, ...overrides } } };
    return { group: await MarcatoriAssiRender.creaMarcatori(20.7, 298.94, 2.286, opts, theme), texts, assets, fonts };
  } finally { globalThis.document = previousDocument; OggettiSempliciRender.getImg = originalGetImg; }
}

test('axis longitude labels show degree, minute and second within the actual sign', () => {
  assert.equal(formatAxisDms(20 + 42 / 60 + 46 / 3600), '20°42′46″');
  assert.equal(formatAxisDms(328 + 56 / 60 + 24 / 3600), '28°56′24″');
  assert.equal(formatAxisDms(-0.00001), '0°00′00″');
  assert.equal(formatAxisDms(29 + 59 / 60 + 59.6 / 3600), '0°00′00″');
  assert.equal(formatAxisDegreeSeconds(20 + 42 / 60 + 46 / 3600), '20°46″');
  assert.equal(formatAxisDegreeTenths(20 + 42 / 60 + 46 / 3600), '20,7°');
  assert.equal(formatAxisDegreeTenths(328.94), '28,9°');
  assert.equal(formatAxisDegreeTenths(29.96), '0,0°');
  assert.equal(formatAxisDegreeTenths(-1.24), '28,8°');
});

test('planetary hour comes from the matching time interval, not a guessed weekday', () => {
  assert.equal(planetaryHourAt(hours), 'Jupiter');
  assert.equal(planetaryHourAt({ ...hours, dataora: '2000-01-01 19:20:00' }), 'Mercury');
  assert.equal(planetaryHourAt({ ...hours, dataora: '2000-01-02 07:00:00' }), null);
  assert.equal(planetaryHourAt({ ...hours, dh: {} }), null);
  assert.equal(planetaryHourAt({}), null);
});

test('ASC, DS, MC and IC each have separate visible toggles and use source longitudes', async () => {
  const { group, texts, assets, fonts } = await makeMarkers();
  const ids = group.children.map(child => child.userData.axisMarker).filter(Boolean);
  assert.deepEqual(ids.sort(), ['ASC','DS','MC','IC','MC-motion'].sort());
  assert.ok(texts.includes('20°00″'));
  assert.ok(texts.includes('28,9°'));
  assert.ok(!texts.includes('Ora'), 'planetary hour must use its glyph alone');
  assert.ok(fonts.every(font => !font.includes('italic')),
    'axis degrees use an upright, non-italic face');
  assert.deepEqual(assets, ['simboli-bianchi/elementi-celesti/Jupiter.png']);
  assert.equal(group.children.find(child => child.userData.axis === 'planetary-hour-glyph')?.userData.planetaryHour, 'Jupiter');
  const markers = Object.fromEntries(group.children.filter(child => child.userData.axisMarker)
    .map(child => [child.userData.axisMarker, child]));
  assert.ok(markers.ASC.isLineSegments, 'ASC is a simple two-stroke open arrow');
  assert.ok(markers.DS.isPoints, 'DS ends in a small filled dot');
  assert.ok(markers.MC.isLineSegments, 'MC is a simple two-stroke open arrow');
  assert.ok(markers.IC.isPoints, 'IC ends in a quiet point');
  assert.ok(markers['MC-motion'].isMesh, 'MC direction is a filled triangle');
  assert.equal(markers['MC-motion'].material.color.getHexString(), 'b58bd8');
  for (const label of group.children.filter(child => ['ASC','MC'].includes(child.userData.axis))) {
    assert.equal(label.geometry.parameters.width, label.userData.axis === 'ASC' ? 0.32 : 0.47);
    assert.equal(label.geometry.parameters.height, label.userData.axis === 'ASC' ? 0.10 : 0.12);
  }

  const hidden = await makeMarkers({
    mostraFrecciaAscendente: false, mostraRetroFrecciaDiscendente: false,
    mostraFrecciaMC: false, mostraRetroFrecciaIC: false,
    mostraGradiAssi: false, mostraOraPlanetariaAscendente: false,
    mostraDirezioneMotoMC: false,
  });
  assert.equal(hidden.group.children.length, 0);
  assert.deepEqual(hidden.texts, []);
});

test('axis strokes stop at the zodiac degree ticks and degree captions follow the reference placement', async () => {
  const radius = 2.286;
  const tickRadius = radius * 103 / 120;
  const { group } = await makeMarkers();
  const stems = group.children.filter(child => child.userData.axisStem);
  assert.deepEqual(stems.map(stem => stem.userData.axisStem).sort(), ['ASC','DS','MC','IC'].sort());
  for (const stem of stems) {
    const vertex = stem.geometry.attributes.position.array;
    const fromRadius = Math.hypot(vertex[0], vertex[1]);
    const toRadius = Math.hypot(vertex[3], vertex[4]);
    assert.ok(Math.abs(fromRadius - tickRadius) < 1e-6,
      `${stem.userData.axisStem}: line must end at zodiac degree tick, not a house cusp`);
    assert.ok(toRadius > radius + 0.35 && toRadius < radius + 0.5,
      `${stem.userData.axisStem}: line must finish just beyond the chart`);
  }
  const ascDegree = group.children.find(child => child.userData.axis === 'ASC');
  const planetaryHour = group.children.find(child => child.userData.axis === 'planetary-hour-glyph');
  const mcDegree = group.children.find(child => child.userData.axis === 'MC');
  assert.ok(ascDegree && mcDegree && planetaryHour);
  const expectedAscMidpoint = -(radius + (0.47 - 0.095) / 2);
  assert.ok(Math.abs(ascDegree.position.x - expectedAscMidpoint) < 1e-6,
    'ASC degree must be midway between the zodiac and the beginning of the arrowhead');
  assert.ok(Math.abs(planetaryHour.position.x - ascDegree.position.x) < 1e-6,
    'planetary-hour glyph must be centred on the same ASC arrow segment');
  assert.ok(planetaryHour.position.y > ascDegree.position.y + 0.12,
    'planetary hour must sit above the degree, without overlapping it');
  assert.ok(ascDegree.position.y > 0.02 && ascDegree.position.y < 0.05,
    'ASC degree must sit close above its shaft');
  assert.equal(group.children.find(child => child.userData.axisMarker === 'IC').material.size, 6,
    'terminal IC dot must be large enough to see');
  assert.equal(group.children.find(child => child.userData.axisMarker === 'DS').material.size, 6,
    'DS dot must match the IC dot');
  const mcAngle = (90 - 20.7 + 298.94) * Math.PI / 180;
  const mcStemX = -Math.sin(mcAngle) * (radius + 0.36);
  assert.ok(mcDegree.position.x < mcStemX - 0.25,
    'MC degree must sit to the left of the upward arrow');
});

test('individual annotations and signed MC motion can be hidden independently', async () => {
  const { group, texts } = await makeMarkers({
    mostraGradiAssi: false, mostraOraPlanetariaAscendente: false,
    mostraRetroFrecciaDiscendente: false, mostraDirezioneMotoMC: false,
  });
  assert.deepEqual(texts, []);
  assert.ok(!group.children.some(child => child.userData.axisMarker === 'DS'));
  assert.ok(!group.children.some(child => child.userData.axisMarker === 'MC-motion'));

  const forwards = (await makeMarkers({}, { mcSpeed: 1 })).group.children.find(child => child.userData.axisMarker === 'MC-motion');
  const backwards = (await makeMarkers({}, { mcSpeed: -1 })).group.children.find(child => child.userData.axisMarker === 'MC-motion');
  assert.ok(forwards && backwards);
  assert.notDeepEqual(
    [...forwards.geometry.attributes.position.array],
    [...backwards.geometry.attributes.position.array],
    'the small MC arrow must reverse if the supplied MC velocity is negative',
  );
});
