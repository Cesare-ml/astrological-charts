import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  stdin: {
    contents: [
      "export { MarcatoriAssiRender, formatAxisDms, formatAxisDegreeSeconds, formatAxisDegreeTenths, formatAxisDegreeMinutes, planetaryHourAt } from './src/lib/renderers/moduli/marcatori-assi.renderer';",
      "export { defaultOpzioniGrafico } from './src/lib/models/opzioni-grafico.model';",
      "export { OggettiSempliciRender } from './src/lib/renderers/oggetti-semplici.renderer';",
      "export * as THREE from 'three';",
    ].join('\n'),
    resolveDir: process.cwd(), sourcefile: 'axis-marker-harness.ts', loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022',
});
const { MarcatoriAssiRender, formatAxisDms, formatAxisDegreeSeconds, formatAxisDegreeTenths, formatAxisDegreeMinutes, planetaryHourAt, defaultOpzioniGrafico, OggettiSempliciRender, THREE } =
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
    if (!options.settaggi) opts.settaggi.skin_id = 'light';
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
  assert.equal(formatAxisDegreeMinutes(20), '20° 0′');
  assert.equal(formatAxisDegreeMinutes(20.7), '20° 42′');
  assert.equal(formatAxisDegreeMinutes(328.94), '28° 56′');
  assert.equal(formatAxisDegreeMinutes(29.999), '0° 0′');
  assert.equal(formatAxisDegreeMinutes(-1.24), '28° 46′');
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
  assert.deepEqual(ids.sort(), ['ASC','DS','MC','IC'].sort(),
    'the reference chart has no extra movement triangle on the MC shaft');
  assert.ok(texts.includes('20° 42′'));
  assert.ok(texts.includes('28° 56′'));
  assert.ok(!texts.includes('Ora'), 'planetary hour must use its glyph alone');
  assert.ok(fonts.every(font => !font.includes('italic')),
    'axis degrees use an upright, non-italic face');
  assert.deepEqual(assets, ['simboli-bianchi/elementi-celesti/Jupiter.png']);
  assert.equal(group.children.find(child => child.userData.axis === 'planetary-hour-glyph')?.userData.planetaryHour, 'Jupiter');
  const markers = Object.fromEntries(group.children.filter(child => child.userData.axisMarker)
    .map(child => [child.userData.axisMarker, child]));
  assert.equal(group.userData.chartInteractionRole, 'natal-axes');
  for (const [key, name, longitude] of [['ASC','AS',20.7],['DS','DS',200.7],['MC','MC',298.94],['IC','IC',118.94]]) {
    assert.equal(markers[key].userData.planet, name);
    assert.ok(Math.abs(markers[key].userData.trueLongitude - longitude) < 1e-9);
  }
  assert.ok(markers.ASC.isLineSegments, 'ASC is a simple two-stroke open arrow');
  assert.ok(markers.DS.isMesh && markers.DS.geometry.type === 'CircleGeometry',
    'DS ends in a properly round disc, not a square point');
  assert.ok(markers.MC.isLineSegments, 'MC is a simple two-stroke open arrow');
  assert.ok(markers.IC.isMesh && markers.IC.geometry.type === 'CircleGeometry',
    'IC ends in a properly round disc, not a square point');
  assert.equal(markers['MC-motion'], undefined,
    'MC motion indicator must be opt-in, unlike the arrowhead');
  for (const label of group.children.filter(child => ['ASC','MC'].includes(child.userData.axis))) {
    assert.equal(label.geometry.parameters.width, 0.64);
    assert.equal(label.geometry.parameters.height, 0.18);
  }
  assert.ok(fonts.every(font => font.includes('Times New Roman') && !font.includes('italic')),
    'axis headings and degrees must use a clear non-italic Times-like canvas font');
  for (const name of group.children.filter(child => child.userData.axisName)) {
    assert.equal(name.geometry.parameters.width, 0.77);
    assert.equal(name.geometry.parameters.height, 0.24);
    assert.ok(Math.abs(name.geometry.parameters.width / name.geometry.parameters.height - 512 / 160) < 0.03,
      'the canvas texture must not compress letters horizontally');
  }

  const hidden = await makeMarkers({
    mostraFrecciaAscendente: false, mostraRetroFrecciaDiscendente: false,
    mostraFrecciaMC: false, mostraRetroFrecciaIC: false,
    mostraGradiAssi: false, mostraNomiAssi: false, mostraOraPlanetariaAscendente: false,
    mostraDirezioneMotoMC: false,
  });
  assert.equal(hidden.group.children.length, 0);
  assert.deepEqual(hidden.texts, []);
});

test('transit charts retain their axis stems but hide names, degrees, hour and MC motion', async () => {
  const original = structuredClone(defaultOpzioniGrafico);
  original.mostraDirezioneMotoMC = true;
  const normal = MarcatoriAssiRender.getPresentationOptions(original);
  assert.equal(normal, original, 'ordinary natal presentation must remain identical');
  const suppressed = MarcatoriAssiRender.getPresentationOptions({...original, mostraTransiti: true});
  for (const option of ['mostraNomiAssi', 'mostraGradiAssi',
    'mostraOraPlanetariaAscendente', 'mostraDirezioneMotoMC']) {
    assert.equal(suppressed[option], false);
  }
  const {group, texts, assets} = await makeMarkers(suppressed);
  assert.deepEqual(texts, []);
  assert.deepEqual(assets, []);
  assert.deepEqual(group.children.filter(child => child.userData.axisStem)
    .map(child => child.userData.axisStem).sort(), ['ASC','DS','IC','MC']);
  assert.ok(!group.children.some(child => child.userData.axisMarker === 'MC-motion'));
  assert.ok(!group.children.some(child => child.userData.axisName || child.userData.axis));
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
    const extensions = { ASC: 0.17, DS: 0.22, MC: 0.18, IC: 0.22 };
    assert.ok(Math.abs(toRadius - radius - extensions[stem.userData.axisStem]) < 1e-6,
      `${stem.userData.axisStem}: marker stem extension differs from the approved layout`);
  }
  const ascName = group.children.find(child => child.userData.axisName === 'ASC');
  const mcName = group.children.find(child => child.userData.axisName === 'MC');
  const ascDegree = group.children.find(child => child.userData.axis === 'ASC');
  const planetaryHour = group.children.find(child => child.userData.axis === 'planetary-hour-glyph');
  const mcDegree = group.children.find(child => child.userData.axis === 'MC');
  assert.ok(ascName && mcName && ascDegree && mcDegree && planetaryHour);
  assert.ok(Math.abs(ascDegree.position.x - ascName.position.x) < 1e-6,
    'the ASC degree must be directly below the ASC heading');
  assert.ok(ascDegree.position.y < ascName.position.y - 0.18,
    'ASC degree must be below the label, not along the arrow shaft');
  assert.ok(ascName.position.x < -(radius + 0.17),
    'ASC heading must sit beyond the shortened arrowhead');
  assert.ok(Math.abs(planetaryHour.position.x - ascName.position.x) < 1e-6,
    'the planetary-hour glyph must be horizontally centered above ASC');
  assert.ok(planetaryHour.position.y > ascName.position.y + 0.18,
    'planetary hour must remain above the shaft');
  for (const axis of ['DS', 'IC']) {
    const terminal = group.children.find(child => child.userData.axisMarker === axis);
    assert.equal(terminal.geometry.parameters.radius, 0.033,
      `${axis} must have the slightly larger circular terminal`);
    assert.equal(terminal.geometry.parameters.segments, 32,
      `${axis} must have a smooth rounded edge`);
    const stem = stems.find(child => child.userData.axisStem === axis);
    const vertex = stem.geometry.attributes.position.array;
    assert.ok(Math.hypot(terminal.position.x - vertex[3], terminal.position.y - vertex[4]) < 1e-6,
      `${axis} disc must be centred exactly on its line endpoint`);
  }
  const mcAngle = (90 - 20.7 + 298.94) * Math.PI / 180;
  const mcRadial = {x: -Math.sin(mcAngle), y: Math.cos(mcAngle)};
  const projection = point => point.x * mcRadial.x + point.y * mcRadial.y;
  assert.ok(projection(mcName.position) > projection(mcDegree.position) &&
    projection(mcDegree.position) > radius + 0.18,
    'the MC heading must be above its degree, which is above the arrowhead');
  assert.ok(Math.abs(projection(mcName.position) - (radius + 0.45)) < 1e-6,
    'the MC heading must sit close to the shortened arrowhead');
  assert.ok(Math.abs(projection(mcDegree.position) - (radius + 0.30)) < 1e-6,
    'the MC degree must move down with its heading, without touching the arrow tip');
  for (const axis of ['DS', 'IC']) {
    const terminal = group.children.find(child => child.userData.axisMarker === axis);
    const heading = group.children.find(child => child.userData.axisName === axis);
    assert.ok(terminal.position.distanceTo(heading.position) >= 0.18 &&
      terminal.position.distanceTo(heading.position) <= 0.22,
      `${axis}: shortened name-to-dot spacing must be close but not overlapping`);
  }
  assert.ok(Math.abs(mcDegree.position.x * mcRadial.y - mcDegree.position.y * mcRadial.x) < 1e-6,
    'MC degree must be centered on the axis, never displaced to its left');
  for (const axis of ['ASC', 'MC']) {
    const arrow = group.children.find(child => child.userData.axisMarker === axis);
    const vertices = arrow.geometry.attributes.position;
    assert.equal(vertices.count, 4, `${axis}: an open V uses exactly two strokes`);
    const left = new THREE.Vector3().fromBufferAttribute(vertices, 0);
    const tip = new THREE.Vector3().fromBufferAttribute(vertices, 1);
    const right = new THREE.Vector3().fromBufferAttribute(vertices, 2);
    assert.ok(left.distanceTo(right) > 0.085 && left.distanceTo(right) < 0.087,
      `${axis}: the open V must match the reference width`);
    assert.ok(tip.distanceTo(left) > 0.085 && tip.distanceTo(right) < 0.088);
  }
});

test('individual annotations and signed MC motion can be hidden independently', async () => {
  const { group, texts } = await makeMarkers({
    mostraGradiAssi: false, mostraNomiAssi: false, mostraOraPlanetariaAscendente: false,
    mostraRetroFrecciaDiscendente: false, mostraDirezioneMotoMC: false,
  });
  assert.deepEqual(texts, []);
  assert.ok(!group.children.some(child => child.userData.axisMarker === 'DS'));
  assert.ok(!group.children.some(child => child.userData.axisMarker === 'MC-motion'));

  const forwards = (await makeMarkers({mostraDirezioneMotoMC: true}, { mcSpeed: 1 })).group.children.find(child => child.userData.axisMarker === 'MC-motion');
  const backwards = (await makeMarkers({mostraDirezioneMotoMC: true}, { mcSpeed: -1 })).group.children.find(child => child.userData.axisMarker === 'MC-motion');
  assert.ok(forwards && backwards);
  assert.notDeepEqual(
    [...forwards.geometry.attributes.position.array],
    [...backwards.geometry.attributes.position.array],
    'the small MC arrow must reverse if the supplied MC velocity is negative',
  );
  const mcAngle = (90 - 20.7 + 298.94) * Math.PI / 180;
  const radial = {x: -Math.sin(mcAngle), y: Math.cos(mcAngle)};
  const radii = [...Array.from(forwards.geometry.attributes.position.array)].reduce((result, coordinate, index, arr) => {
    if (index % 3 === 0) result.push(coordinate * radial.x + arr[index + 1] * radial.y);
    return result;
  }, []);
  const triangleMidpoint = (Math.min(...radii) + Math.max(...radii)) / 2;
  assert.ok(Math.abs(triangleMidpoint - (2.286 + (0.18 - 0.075) / 2)) < 0.01,
    'MC movement triangle belongs halfway between the signs and the arrowhead base');
  assert.ok(Math.abs(Math.max(...radii) - Math.min(...radii) - 0.038) < 1e-5,
    'MC direction triangle radial height must be at most half its former size');
  const vertices = forwards.geometry.attributes.position.array;
  const tangents = [];
  for (let index = 0; index < vertices.length; index += 3) {
    tangents.push(vertices[index] * -radial.y + vertices[index + 1] * radial.x);
  }
  assert.ok(Math.abs(Math.max(...tangents) - Math.min(...tangents) - 0.047) < 1e-5,
    'MC direction triangle must also be at most half as wide as before');
});

test('axis names are geometry-shared between skins, but the official palette is skin-scoped', async () => {
  const original = await makeMarkers({mostraDirezioneMotoMC: true});
  const official = await makeMarkers({ mostraDirezioneMotoMC: true, settaggi: { skin_id: 'virgostars' } });
  const names = group => group.children.filter(child => child.userData.axisName);
  assert.deepEqual(names(original.group).map(child => child.userData.axisName), ['ASC','DS','MC','IC']);
  assert.deepEqual(names(official.group).map(child => child.userData.axisName), ['ASC','DS','MC','IC']);
  for (let i = 0; i < 4; i++) {
    assert.equal(names(original.group)[i].position.x, names(official.group)[i].position.x);
    assert.equal(names(original.group)[i].position.y, names(official.group)[i].position.y);
  }
  const originalMc = original.group.children.find(child => child.userData.axisMarker === 'MC-motion');
  const officialMc = official.group.children.find(child => child.userData.axisMarker === 'MC-motion');
  assert.equal(originalMc.material.color.getHexString(), 'b58bd8');
  assert.equal(officialMc.material.color.getHexString(), 'a981d6');
  assert.ok(official.fonts.some(font => font.includes('Georgia')), 'official heading typography');
  assert.ok(official.texts.includes('DS') && !official.texts.includes('DSC'));
  assert.ok(!official.texts.some(value => value.startsWith('DS ') || value.startsWith('IC ')),
    'DS/IC must not repeat the opposite cardinal degree');
});
