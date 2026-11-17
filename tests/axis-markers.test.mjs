import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  stdin: {
    contents: [
      "export { MarcatoriAssiRender, formatAxisDms, planetaryHourAt } from './src/lib/renderers/moduli/marcatori-assi.renderer';",
      "export { defaultOpzioniGrafico } from './src/lib/models/opzioni-grafico.model';",
    ].join('\n'),
    resolveDir: process.cwd(), sourcefile: 'axis-marker-harness.ts', loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022',
});
const { MarcatoriAssiRender, formatAxisDms, planetaryHourAt, defaultOpzioniGrafico } =
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

function makeMarkers(options = {}, overrides = {}) {
  const previousDocument = globalThis.document;
  const texts = [];
  globalThis.document = {
    createElement(name) {
      assert.equal(name, 'canvas');
      return {
        width: 0, height: 0,
        getContext() { return { clearRect() {}, fillText(text) { texts.push(text); } }; },
      };
    },
  };
  try {
    const opts = { ...structuredClone(defaultOpzioniGrafico), ...options };
    const theme = { orePlanetarie: structuredClone(hours), houses: { egizia: { mcSpeed: 1, ...overrides } } };
    return { group: MarcatoriAssiRender.creaMarcatori(20.7, 298.94, 2.286, opts, theme), texts };
  } finally { globalThis.document = previousDocument; }
}

test('axis longitude labels show degree, minute and second within the actual sign', () => {
  assert.equal(formatAxisDms(20 + 42 / 60 + 46 / 3600), '20° 42′ 46″');
  assert.equal(formatAxisDms(328 + 56 / 60 + 24 / 3600), '28° 56′ 24″');
  assert.equal(formatAxisDms(-0.00001), '0° 00′ 00″');
  assert.equal(formatAxisDms(29 + 59 / 60 + 59.6 / 3600), '0° 00′ 00″');
});

test('planetary hour comes from the matching time interval, not a guessed weekday', () => {
  assert.equal(planetaryHourAt(hours), 'Jupiter');
  assert.equal(planetaryHourAt({ ...hours, dataora: '2000-01-01 19:20:00' }), 'Mercury');
  assert.equal(planetaryHourAt({ ...hours, dataora: '2000-01-02 07:00:00' }), null);
  assert.equal(planetaryHourAt({ ...hours, dh: {} }), null);
  assert.equal(planetaryHourAt({}), null);
});

test('ASC, DS, MC and IC each have separate visible toggles and use source longitudes', () => {
  const { group, texts } = makeMarkers();
  const ids = group.children.map(child => child.userData.axisMarker).filter(Boolean);
  assert.deepEqual(ids.sort(), ['ASC','DS','MC','IC','MC-motion'].sort());
  assert.ok(texts.includes('20° 42′ 00″'));
  assert.ok(texts.includes('28° 56′ 24″'));
  assert.ok(texts.includes('Ora ♃'));

  const hidden = makeMarkers({
    mostraFrecciaAscendente: false, mostraRetroFrecciaDiscendente: false,
    mostraFrecciaMC: false, mostraRetroFrecciaIC: false,
    mostraGradiAssi: false, mostraOraPlanetariaAscendente: false,
    mostraDirezioneMotoMC: false,
  });
  assert.equal(hidden.group.children.length, 0);
  assert.deepEqual(hidden.texts, []);
});

test('individual annotations and signed MC motion can be hidden independently', () => {
  const { group, texts } = makeMarkers({
    mostraGradiAssi: false, mostraOraPlanetariaAscendente: false,
    mostraRetroFrecciaDiscendente: false, mostraDirezioneMotoMC: false,
  });
  assert.deepEqual(texts, []);
  assert.ok(!group.children.some(child => child.userData.axisMarker === 'DS'));
  assert.ok(!group.children.some(child => child.userData.axisMarker === 'MC-motion'));

  const forwards = makeMarkers({}, { mcSpeed: 1 }).group.children.find(child => child.userData.axisMarker === 'MC-motion');
  const backwards = makeMarkers({}, { mcSpeed: -1 }).group.children.find(child => child.userData.axisMarker === 'MC-motion');
  assert.ok(forwards && backwards);
  assert.notDeepEqual(
    [...forwards.geometry.attributes.position.array],
    [...backwards.geometry.attributes.position.array],
    'the small MC arrow must reverse if the supplied MC velocity is negative',
  );
});
