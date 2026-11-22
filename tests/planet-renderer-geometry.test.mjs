import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  stdin: {
    contents: [
      "export { ElementiCelestiRender } from './src/lib/renderers/moduli/elementi-celesti.renderer';",
      "export { OggettiSempliciRender } from './src/lib/renderers/oggetti-semplici.renderer';",
      "export { calcolaDiametri } from './src/lib/renderers/@carta-astrale/carta-astrale.renderer';",
      "export { defaultOpzioniGrafico } from './src/lib/models/opzioni-grafico.model';",
      "export * as THREE from 'three';",
    ].join('\n'),
    resolveDir: process.cwd(),
    sourcefile: 'planet-renderer-test-harness.ts',
    loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022',
});
const { ElementiCelestiRender, OggettiSempliciRender, calcolaDiametri, defaultOpzioniGrafico, THREE } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('ordinary transits retain the natal zodiac diameter and proportional outer grid', () => {
  const options = structuredClone(defaultOpzioniGrafico);
  const theme = { houses: { [options.settaggi.domificazione_selezionata]: { ascendant: 20, mc: 290 } } };
  const natal = calcolaDiametri(options, theme, null, null).diametri;
  options.mostraTransiti = true;
  const transits = calcolaDiametri(options, theme, theme, null).diametri;
  assert.equal(natal.diametroAnelloSegni, 4.5723);
  assert.equal(transits.diametroAnelloSegni, natal.diametroAnelloSegni);
  assert.equal(transits.diametroAnelloTransiti, natal.diametroAnelloTransiti);
  assert.equal(transits.diametroAnelloElementiCelesti, natal.diametroAnelloElementiCelesti);
  options.mostraTransitiSinodici = true;
  assert.equal(calcolaDiametri(options, { ...theme, transitiSinodici: {} }, theme, null)
    .diametri.diametroAnelloSegni, 1.4, 'synodic overlays keep their special scale');
});

const planetLongitudes = {
  Sun: 358.51234, Moon: 359.2, Mercury: 0.1, Venus: 1.4,
  Mars: 2.3, Jupiter: 3.1, Saturn: 4.2,
};
const innerRadius = 1.43;
const outerRadius = 1.83;

test('canonical conjunct-outer setting includes hidden bodies across Aries and respects the orb', () => {
  const options = structuredClone(defaultOpzioniGrafico);
  for (const option of Object.values(options.settaggi.elementi_celesti)) option.att = false;
  options.settaggi.elementi_celesti.Sun.att = true;
  options.settaggi.elementi_celesti.Uranus.orb = 3;
  options.settaggi.transaturnini_se_congiunti = true;
  const theme = {planets:{Sun:{longitude:359}, Uranus:{longitude:1}},
    houses:{[options.settaggi.domificazione_selezionata]:{ascendant:40, mc:130}}};
  assert.ok(ElementiCelestiRender.getElementiCelesti(theme,options,false).Uranus);
  theme.planets.Uranus.longitude = 2;
  assert.equal(ElementiCelestiRender.getElementiCelesti(theme,options,false).Uranus,undefined);
  options.settaggi.transaturnini_se_congiunti = false;
  theme.planets.Uranus.longitude = 1;
  assert.equal(ElementiCelestiRender.getElementiCelesti(theme,options,false).Uranus,undefined);
});

function polar(degree, radius) {
  const radians = degree * Math.PI / 180;
  return { x: -Math.sin(radians) * radius, y: Math.cos(radians) * radius };
}
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function visibleRectangle(mesh) {
  const { width, height } = mesh.geometry.parameters;
  return {
    x: mesh.position.x,
    y: mesh.position.y,
    width: width * mesh.scale.x,
    height: height * mesh.scale.y,
  };
}

function overlapArea(a, b) {
  const width = (a.width + b.width) / 2 - Math.abs(a.x - b.x);
  const height = (a.height + b.height) / 2 - Math.abs(a.y - b.y);
  return Math.max(0, width) * Math.max(0, height);
}

function segmentCrossesRectangle(coords, rectangle, padding = 0.005) {
  const xMin = rectangle.x - rectangle.width / 2 - padding;
  const xMax = rectangle.x + rectangle.width / 2 + padding;
  const yMin = rectangle.y - rectangle.height / 2 - padding;
  const yMax = rectangle.y + rectangle.height / 2 + padding;
  let minT = 0, maxT = 1;
  for (const [start, end, min, max] of [
    [coords[0], coords[3], xMin, xMax],
    [coords[1], coords[4], yMin, yMax],
  ]) {
    const delta = end - start;
    if (Math.abs(delta) < 1e-12) {
      if (start < min || start > max) return false;
    } else {
      const lo = (min - start) / delta;
      const hi = (max - start) / delta;
      minT = Math.max(minT, Math.min(lo, hi));
      maxT = Math.min(maxT, Math.max(lo, hi));
      if (minT > maxT) return false;
    }
  }
  return true;
}

async function makeScene(showDegrees, longitudeOffset = 0, symbolScale = 1,
  outerRingRadius = outerRadius, innerRingRadius = innerRadius, source = planetLongitudes,
  axisPresentation = 'default', protectedAxes = [], synastryPrimary = false,
  transitsPrimary = false, externalConnector = true, houseBoundaryRadius, extraOptions = {}, skin = 'light') {
  const originalGetImg = OggettiSempliciRender.getImg;
  const originalGetLinea = OggettiSempliciRender.getLinea;
  const originalDocument = globalThis.document;
  const labels = [];
  const fonts = [];
  try {
    OggettiSempliciRender.getImg = async (ref, width, height, scale, inverted, color) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width * scale, height * scale),
        new THREE.MeshBasicMaterial({ transparent: true }),
      );
      mesh.userData.ref = ref;
      mesh.userData.tint = color;
      return mesh;
    };
    OggettiSempliciRender.getLinea = (from, to, color) => {
      const line = new THREE.Group();
      line.userData.connector = {
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
        color,
      };
      return line;
    };
    // Three's CanvasTexture needs only an image object during scene creation;
    // rendering/uploading to a GPU is intentionally outside this test.
    globalThis.document = {
      createElement(tag) {
        assert.equal(tag, 'canvas');
        const canvas = {
          width: 0, height: 0,
          getContext() {
            return {
              clearRect() {},
              fillText(value) { canvas.testLabel = value; labels.push(value); fonts.push(this.font); },
            };
          },
        };
        return canvas;
      },
    };
    const options = structuredClone(defaultOpzioniGrafico);
    Object.assign(options, extraOptions);
    options.settaggi.skin_id = skin;
    options.settaggi.elementi_celesti = Object.fromEntries(
      Object.keys(source).map(name => [name, { att: true }]),
    );
    if (showDegrees !== undefined) options.mostraGradiElementiCelesti = showDegrees;
    else delete options.mostraGradiElementiCelesti;
    if (synastryPrimary) options.mostraSinastria = true;
    if (transitsPrimary) options.mostraTransiti = true;
    const theme = {
      planets: Object.fromEntries(
        Object.entries(source).map(([name, longitude]) =>
          [name, { longitude: (longitude + longitudeOffset) % 360, longitudeSpeed: 0 }]),
      ),
      houses: { [options.settaggi.domificazione_selezionata]: { ascendant: 20, mc: 290 } },
    };
    const initial = structuredClone(theme);
    const group = await ElementiCelestiRender.getAnelloElementiCelesti(
      theme, 0, [], symbolScale, options, [], [], innerRingRadius * 2, outerRingRadius * 2,
      innerRingRadius * 2, externalConnector, false, 'longitude', true, false,
      0, 0, 0, false, false,
      axisPresentation, protectedAxes, houseBoundaryRadius,
    );
    assert.deepEqual(theme, initial, 'renderer must not mutate original positions');
    return { group, labels, fonts };
  } finally {
    OggettiSempliciRender.getImg = originalGetImg;
    OggettiSempliciRender.getLinea = originalGetLinea;
    globalThis.document = originalDocument;
  }
}

test('all nine Kleroi keep their colors across skins while normal points use the skin', async () => {
  const source = {Tyche:10,Daimon:40,Basis:70,Ananke:100,Eros:130,Hermes:160,Tolma:190,Nike:220,Nemesi:250,Sun:280};
  const expected = {Tyche:'#9324e8',Daimon:'#f9b62b',Basis:'#149432',Ananke:'#ad5916',
    Eros:'#009933',Hermes:'#FFED00',Tolma:'#FF6600',Nike:'#0077FF',Nemesi:'#9E02FF'};
  for (const skin of ['light','dark','virgostars']) {
    const {group} = await makeScene(false,0,1,outerRadius,innerRadius,source,'default',[],false,false,true,undefined,{kleros:'visualizza sorti'},skin);
    const tint = {};
    group.traverse(object => {
      const match = /^simboli-bianchi\/elementi-celesti\/(.+)\.png$/.exec(object.userData.ref ?? '');
      if (match) tint[match[1]] = object.userData.tint;
    });
    for (const [name, color] of Object.entries(expected)) assert.equal(tint[name],color,`${skin}: ${name}`);
    assert.ok(Object.hasOwn(tint,'Sun'),`${skin}: ordinary planet remains visible`);
  }
});

test('desktop can hide only axes that have visible external markers', async () => {
  const source = {Sun:10, AS:20, DS:200, MC:290, IC:110};
  const make = extra => makeScene(true,0,1,outerRadius,innerRadius,source,'default',[],false,false,true,undefined,extra);
  const names = group => group.children.filter(child => child.userData.planet).map(child => child.userData.planet).sort();
  const legacy = await make({});
  assert.deepEqual(names(legacy.group), ['AS','DS','IC','MC','Sun']);
  const desktop = await make({nascondiAssiDuplicati:true});
  assert.deepEqual(names(desktop.group), ['Sun']);
  const noMc = await make({nascondiAssiDuplicati:true, mostraFrecciaMC:false});
  assert.deepEqual(names(noMc.group), ['MC','Sun']);
});

test('transits omit their degrees and duplicate axes while natal planets retain degrees', async () => {
  const source = { Sun: 10, Moon: 48, Jupiter: 148, AS: 20, DS: 200, MC: 290, IC: 110 };
  const primary = await makeScene(true, 0, 1, outerRadius, innerRadius, source, 'primary-overlay');
  const secondary = await makeScene(true, 0, 1, outerRadius, innerRadius, source, 'transit-overlay');
  const names = group => group.children.filter(child => child.userData.planet)
    .map(child => child.userData.planet).sort();
  assert.deepEqual(names(primary.group), ['Jupiter', 'Moon', 'Sun'],
    'external natal arrows already supply all four main axis positions');
  assert.deepEqual(names(secondary.group), ['Jupiter', 'Moon', 'Sun'],
    'transits must not repeat the primary axis markings');
  assert.deepEqual(primary.labels.sort(), ['10°', '18°', '28°'].sort(),
    'primary planets still display their true sign degrees');
  assert.deepEqual(secondary.labels, [], 'transiting planets never show degree badges');
});

test('selecting a natal dodecatemorion leaves transit glyphs fully visible', async () => {
  const options={dodecatemoriAttivi:true,dodecatemore:'Sun'};
  const primary=await makeScene(false,0,1,outerRadius,innerRadius,{Sun:10,Moon:48},'primary-overlay',[],false,true,true,undefined,options);
  const transit=await makeScene(false,0,1,outerRadius,innerRadius,{Sun:10,Moon:48},'transit-overlay',[],false,false,true,undefined,options);
  const glyphs=group=>group.children.filter(child=>child.userData.planet);
  assert.ok(glyphs(primary.group).every(glyph=>glyph.material.opacity===0.3));
  assert.ok(glyphs(transit.group).every(glyph=>glyph.material.opacity===1));
});

test('synastry has no planet degrees on either wheel and keeps its independent AS/MC', async () => {
  const source = { Sun: 10, Moon: 48, Jupiter: 148, AS: 20, DS: 200, MC: 290, IC: 110 };
  const primary = await makeScene(true, 0, 1, outerRadius, innerRadius, source,
    'primary-overlay', [], true);
  const secondary = await makeScene(true, 0, 0.8, 1.207, 0.870, source,
    'synastry-overlay');
  assert.deepEqual(primary.labels, [], 'no natal degree badges in synastry mode');
  assert.deepEqual(secondary.labels, [], 'no partner degree badges in synastry mode');
  assert.deepEqual(secondary.group.children.filter(child => child.userData.planet)
    .map(child => child.userData.planet).sort(), ['AS', 'Jupiter', 'MC', 'Moon', 'Sun']);
});

test('composite planets stay on at most two radii without intersecting primary axis arrows', async () => {
  const natalAsc = 20, natalMc = 290;
  const source = {
    Sun: 8.4, Moon: 8.7, Mercury: 9, Venus: 9.2, Mars: 9.5,
    Jupiter: 19.1, Saturn: 20.3, Uranus: 289, Neptune: 290, Pluto: 290.5,
    NorthNode: 355, Lilith: 120,
  };
  for (const offset of [0, 45, 120]) {
    const shifted = Object.fromEntries(Object.entries(source).map(([name, value]) =>
      [name, (value + offset) % 360]));
    const protectedAxes = [(natalAsc + offset) % 360, (natalMc + offset) % 360];
    const { group, labels } = await makeScene(true, 0, 1,
      4.5723 * 146.64 / 120 / 2, 4.5723 / 2,
      shifted, 'transit-overlay', protectedAxes, false, false, false);
    assert.deepEqual(labels, [], 'transits need no additional degree labels');
    const glyphs = group.children.filter(child => child.userData.planet);
    const leaderLines = group.children.filter(child => child.userData.transitConnector);
    assert.equal(glyphs.length, Object.keys(source).length);
    assert.equal(leaderLines.length, Object.keys(source).length,
      'every transit planet gets a translucent true-longitude link to the degree grid');
    for (const connector of leaderLines) {
      assert.equal(connector.material.transparent, true);
      assert.equal(connector.material.opacity, 0.45);
      const p = connector.geometry.attributes.position.array;
      const anchor = polar(90 + shifted[connector.userData.transitConnector], 4.5723 / 2 + 0.012);
      assert.ok(distance({x: p[3], y: p[4]}, anchor) < 1e-6,
        `${connector.userData.transitConnector} leader must hit its true astronomical longitude`);
    }
    const radii = new Set(glyphs.map(mesh => Math.hypot(mesh.position.x, mesh.position.y).toFixed(6)));
    assert.ok(radii.size <= 2, `composite layout used ${radii.size} planet radii`);
    assert.ok(radii.size >= 1);
    for (const glyph of glyphs) {
      const rendered = (Math.atan2(-glyph.position.x, glyph.position.y) * 180 / Math.PI - 90 + 720) % 360;
      for (const axis of protectedAxes.flatMap(x => [x, (x + 180) % 360])) {
        const gap = Math.abs(((rendered - axis + 540) % 360) - 180);
        assert.ok(gap >= 5, `${glyph.userData.planet}: crosses the primary axis at ${axis}°`);
      }
      assert.equal(glyph.userData.trueLongitude, shifted[glyph.userData.planet]);
    }
    for (let i = 0; i < glyphs.length; i++) for (let j = i + 1; j < glyphs.length; j++) {
      assert.equal(overlapArea(visibleRectangle(glyphs[i]), visibleRectangle(glyphs[j])), 0,
        `${glyphs[i].userData.planet}/${glyphs[j].userData.planet} overlap at rotation ${offset}`);
    }
  }
});

test('transits preserve a roomy natal planet band with integer degrees and a true house boundary tick', async () => {
  const outer = 4.5723 * 103 / 120 / 2;
  const inner = 4.5723 * 67.1 / 120 / 2;
  const houseBoundary = 4.5723 * 66.16 / 120 / 2;
  const source = {Sun: 358.4, Moon: 359.1, Mercury: 0.3, Venus: 1.2, Mars: 2.4};
  const {group, labels} = await makeScene(true, 0, 1, outer, inner, source,
    'primary-overlay', [], false, true, true, houseBoundary);
  assert.equal(labels.length, 5, 'natal degrees must remain visible alongside transits');
  const glyphs = group.children.filter(child => child.userData.planet);
  assert.equal(glyphs.length, 5);
  assert.ok(glyphs.every(glyph => Math.abs(glyph.scale.x - 0.18) < 1e-8),
    'natal conjunctions should keep their usual larger full-size glyphs');
  assert.ok(new Set(glyphs.map(glyph => Math.hypot(glyph.position.x, glyph.position.y).toFixed(6))).size <= 2,
    `transit mode must not send natal conjunctions into multiple arbitrary radii: ${JSON.stringify(glyphs.map(glyph => [glyph.userData.planet,Math.hypot(glyph.position.x,glyph.position.y),glyph.scale.x]))}`);
  const badges = group.children.filter(child => child.material?.map?.isCanvasTexture);
  const visible = [...glyphs, ...badges];
  for (let i = 0; i < visible.length; i++) for (let j = i + 1; j < visible.length; j++) {
    if (i < glyphs.length && j - glyphs.length === i) continue; // own degree badge
    assert.equal(overlapArea(visibleRectangle(visible[i]), visibleRectangle(visible[j])), 0,
      `natal glyphs and degree badges must remain separated when transits are enabled: ${visible[i].userData.planet??`badge${badges.indexOf(visible[i])}`} / ${visible[j].userData.planet??`badge${badges.indexOf(visible[j])}`}`);
  }
  const ticks = group.children.filter(child => child.userData.planetHouseTick);
  assert.equal(ticks.length, 5);
  for (const tick of ticks) {
    const p = tick.geometry.attributes.position.array;
    assert.ok(Math.abs(Math.hypot(p[0], p[1]) - houseBoundary) < 1e-6,
      'reference tick must start precisely on the visible house ring');
  }
});

test('synastry natal house ticks touch the house ring even when its glyph band is narrower', async () => {
  const outer = 4.5723 * 103 / 120 / 2;
  const planetBandInner = 4.5723 * 77 / 120 / 2;
  const houseBoundary = 4.5723 * 74.16 / 120 / 2;
  const {group, labels} = await makeScene(true, 0, 1, outer, planetBandInner,
    {Sun: 45, Moon: 78, Venus: 155}, 'primary-overlay', [], true,
    false, true, houseBoundary);
  assert.equal(labels.length, 0);
  for (const tick of group.children.filter(child => child.userData.planetHouseTick)) {
    const p = tick.geometry.attributes.position.array;
    assert.ok(Math.abs(Math.hypot(p[0], p[1]) - houseBoundary) < 1e-6);
  }
});

test('inner synastry planets use only two radii for tight conjunctions', async () => {
  const source = {
    Sun: 358, Moon: 358.2, Mercury: 358.4, Venus: 359, Mars: 359.1,
    Jupiter: 0.1, Saturn: 0.2, Uranus: 0.5, Neptune: 0.8,
  };
  const { group, labels } = await makeScene(true, 0, 0.8,
    4.5723 * 63.36 / 120 / 2, 4.5723 * 45.6666667 / 120 / 2,
    source, 'synastry-overlay');
  assert.deepEqual(labels, []);
  const glyphs = group.children.filter(child => child.userData.planet);
  assert.equal(glyphs.length, 9);
  assert.ok(new Set(glyphs.map(glyph => Math.hypot(glyph.position.x, glyph.position.y).toFixed(6))).size <= 2);
  for (let i = 0; i < glyphs.length; i++) for (let j = i + 1; j < glyphs.length; j++) {
    assert.equal(overlapArea(visibleRectangle(glyphs[i]), visibleRectangle(glyphs[j])), 0);
  }
});

test('Three.js scene keeps every glyph connector anchored at the true degree', async () => {
  const { group, labels, fonts } = await makeScene(true);
  const names = Object.keys(planetLongitudes);
  const glyphs = group.children.filter(child => child.userData.ref);
  const lines = group.children.filter(child => child.userData.connector);
  const numberLabels = group.children.filter(child =>
    child.material?.map?.isCanvasTexture);
  const houseTicks = group.children.filter(child => child.userData.planetHouseTick);
  assert.equal(glyphs.length, names.length);
  assert.equal(lines.length, names.length, 'only the true-degree outer connector remains');
  assert.equal(numberLabels.length, names.length);
  assert.equal(houseTicks.length, names.length,
    'each celestial body needs one discrete mark on the house boundary');
  assert.deepEqual(labels.sort(), ['0°', '1°', '2°', '28°', '29°', '3°', '4°'].sort());
  assert.ok(fonts.includes('bold 90px Arial, sans-serif'), 'integer planet degrees must remain legible');
  for (const label of numberLabels) {
    const radius = Math.hypot(label.position.x, label.position.y);
    assert.ok(radius > innerRadius + 0.03 && radius < outerRadius - 0.03,
      'degree badge must remain within the planet ring');
  }

  for (const name of names) {
    const file = `/${name}.png`;
    const glyph = glyphs.find(child => child.userData.ref.endsWith(file));
    assert.ok(glyph, `missing ${name} glyph`);
    const longitude = planetLongitudes[name];
    const outerAnchor = polar(90 + longitude, outerRadius);
    assert.ok(lines.some(line =>
      distance(line.userData.connector.to, outerAnchor) < 1e-8), `${name} must have a true-degree outer anchor`);
    const tick = houseTicks.find(child => child.userData.planetHouseTick === name);
    assert.ok(tick, `${name}: missing house boundary reference`);
    assert.equal(tick.userData.trueLongitude, longitude);
    const coords = tick.geometry.attributes.position.array;
    const start = polar(90 + longitude, innerRadius);
    const end = polar(90 + longitude, innerRadius + 0.060);
    assert.ok(distance({ x: coords[0], y: coords[1] }, start) < 1e-6,
      `${name}: outer house tick must start at the real, not displaced, longitude`);
    assert.ok(distance({ x: coords[3], y: coords[4] }, end) < 1e-6);
    assert.ok(Math.abs(Math.hypot(coords[0], coords[1]) - innerRadius) < 1e-6 &&
      Math.hypot(coords[3], coords[4]) > innerRadius,
    `${name}: the tick must touch the outside edge without entering the house ring`);
    const connector = lines.find(line => distance(line.userData.connector.to, outerAnchor) < 1e-8);
    const lighter = new THREE.Color(connector.userData.connector.color);
    assert.ok(lighter.r > tick.material.color.r && lighter.g > tick.material.color.g,
      `${name}: outer connector must be lighter than the true-degree house tick`);
    const glyphRadius = Math.hypot(glyph.position.x, glyph.position.y);
    assert.ok(glyphRadius > innerRadius && glyphRadius < outerRadius, `${name} outside ring`);
    const drawnAngle = (Math.atan2(-glyph.position.x, glyph.position.y) * 180 / Math.PI - 90 + 720) % 360;
    const discrepancy = Math.abs(((drawnAngle - longitude + 540) % 360) - 180);
    assert.ok(discrepancy <= 3 + 1e-7, `${name}: glyph displaced ${discrepancy.toFixed(3)}°`);
  }
});

test('five close planets keep full identical glyph sizes on at most two radii within five degrees', async () => {
  const natalInner = 4.5723 * 67.1 / 120 / 2;
  const natalOuter = 4.5723 * 103 / 120 / 2;
  const close = { Sun: 358.4, Moon: 359.1, Mercury: 0.3, Venus: 1.2, Mars: 2.4 };
  for (const offset of [0, 30, 60, 90, 120, 165, 210, 270, 315]) {
    const { group } = await makeScene(true, offset, 1, natalOuter, natalInner, close);
    const glyphs = group.children.filter(child => child.userData.ref);
    const labels = group.children.filter(child => child.material?.map?.isCanvasTexture);
    assert.equal(glyphs.length, 5);
    assert.equal(labels.length, 5);
    assert.equal(new Set(glyphs.map(mesh => mesh.scale.x.toFixed(6))).size, 1,
      'every glyph in the conjunction must have exactly the same dimensions');
    assert.ok(Math.abs(glyphs[0].scale.x - 0.18) < 1e-8,
      'the natal conjunction keeps the newly enlarged uniform glyph size');
    assert.ok(new Set(glyphs.map(mesh => Math.hypot(mesh.position.x, mesh.position.y).toFixed(6))).size <= 2,
      'planet glyphs use one main orbit and at most one inner orbit');
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i], label = labels[i];
      const positionAngle = (Math.atan2(-glyph.position.x, glyph.position.y) * 180 / Math.PI - 90 + 720) % 360;
      const trueDegree = (Object.values(close)[i] + offset) % 360;
      const drift = Math.abs(((positionAngle - trueDegree + 540) % 360) - 180);
      assert.ok(drift <= 5 + 1e-8, `${i}: exceeds the five-degree tolerance (${drift})`);
      const glyphRadius = Math.hypot(glyph.position.x, glyph.position.y);
      const labelRadius = Math.hypot(label.position.x, label.position.y);
      assert.ok(Math.abs(glyphRadius - labelRadius - 0.152) < 1e-5,
        'degree label must be inward toward the houses, close to its planet');
    }
  }
});

test('isolated planets are enlarged while a five-body conjunction keeps uniform smaller glyphs', async () => {
  const natalInner = 4.5723 * 67.1 / 120 / 2;
  const natalOuter = 4.5723 * 103 / 120 / 2;
  const source = {
    Sun: 358.4, Moon: 359.1, Mercury: 0.3, Venus: 1.2, Mars: 2.4,
    Jupiter: 85, Saturn: 170,
  };
  for (const offset of [0, 45, 90, 150, 225, 300]) {
    const { group } = await makeScene(true, offset, 1, natalOuter, natalInner, source);
    const glyphs = Object.fromEntries(group.children.filter(child => child.userData.ref)
      .map(child => [Object.keys(source).find(name => child.userData.ref.endsWith(`/${name}.png`)), child]));
    const size = name => glyphs[name].scale.x;
    assert.ok(Math.abs(size('Jupiter') - 0.24) < 1e-8, 'isolated Jupiter must be slightly larger again');
    assert.ok(Math.abs(size('Saturn') - 0.24) < 1e-8, 'isolated Saturn must be slightly larger again');
    for (const name of ['Sun','Moon','Mercury','Venus','Mars']) {
      assert.ok(Math.abs(size(name) - 0.18) < 1e-8,
        `${name} in the conjunction must retain the compact size`);
    }
    const allGlyphs = Object.values(glyphs);
    assert.ok(new Set(['Sun','Moon','Mercury','Venus','Mars'].map(name =>
      Math.hypot(glyphs[name].position.x, glyphs[name].position.y).toFixed(6))).size <= 2,
      'the conjunction must still use at most two tracks');
    const isolatedOuterEdge = Math.hypot(glyphs.Jupiter.position.x, glyphs.Jupiter.position.y) + 0.24 / 2;
    const compactOuterEdge = Math.max(...['Sun','Moon','Mercury','Venus','Mars'].map(name =>
      Math.hypot(glyphs[name].position.x, glyphs[name].position.y) + 0.18 / 2));
    assert.ok(compactOuterEdge - isolatedOuterEdge >= 0.025,
      `rotation ${offset}: isolated large planets need a greater zodiac gap (actual ${compactOuterEdge - isolatedOuterEdge})`);
    for (const [name, longitude] of Object.entries(source)) {
      const glyph = glyphs[name];
      const display = (Math.atan2(-glyph.position.x, glyph.position.y) * 180 / Math.PI - 90 + 720) % 360;
      const discrepancy = Math.abs(((display - (longitude + offset) % 360 + 540) % 360) - 180);
      assert.ok(discrepancy <= 5 + 1e-8, `${name}: exceeds ±5°`);
    }
    const meshes = [];
    let owner = '';
    for (const child of group.children) {
      if (child.userData.ref) { owner = child.userData.ref; meshes.push({owner, box: visibleRectangle(child)}); }
      else if (child.material?.map?.isCanvasTexture) meshes.push({owner, box: visibleRectangle(child)});
    }
    for (let i = 0; i < meshes.length; i++) for (let j = i + 1; j < meshes.length; j++) {
      if (meshes[i].owner === meshes[j].owner) continue;
      assert.ok(overlapArea(meshes[i].box, meshes[j].box) < 0.00001,
        `isolated vs crowded: overlapping glyph/badge at rotation ${offset}`);
    }
  }
});

test('wide natal renderer keeps Mercury/Venus and Saturn/Neptune large without overlaps', async () => {
  const natalInner = 4.5723 * 67.1 / 120 / 2;
  const natalOuter = 4.5723 * 103 / 120 / 2;
  for (const source of [{Mercury: 7, Venus: 23}, {Saturn: 1, Neptune: 8}]) {
    for (const rotation of [0, 45, 90, 135, 270]) {
      const {group} = await makeScene(true, rotation, 1, natalOuter, natalInner, source);
      const glyphs = group.children.filter(child => child.userData.planet);
      assert.equal(glyphs.length, 2);
      assert.ok(glyphs.every(glyph => Math.abs(glyph.scale.x - 0.24) < 1e-8),
        `rotation ${rotation}: both glyphs should retain the isolated size`);
      const badges = group.children.filter(child => child.material?.map?.isCanvasTexture);
      const boxes = glyphs.flatMap((glyph, index) => [
        {name: glyph.userData.planet, box: visibleRectangle(glyph)},
        {name: glyph.userData.planet, box: visibleRectangle(badges[index])},
      ]);
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        if (boxes[i].name === boxes[j].name) continue;
        assert.equal(overlapArea(boxes[i].box, boxes[j].box), 0,
          `rotation ${rotation}: ${boxes[i].name}/${boxes[j].name} overlap`);
      }
    }
  }
});

test('the degree display is optional and defaults to on for legacy callers', async () => {
  const hidden = await makeScene(false);
  const omitted = await makeScene(undefined);
  const degreeMeshes = scene => scene.group.children.filter(child =>
    child.material?.map?.isCanvasTexture);
  assert.equal(degreeMeshes(hidden).length, 0);
  assert.equal(degreeMeshes(omitted).length, Object.keys(planetLongitudes).length);
  assert.deepEqual(hidden.labels, []);
});

test('no celestial glyph or degree badge covers a neighbouring glyph or badge in a tight conjunction', async () => {
  const orientations = [...Array.from({ length: 24 }, (_, i) => i * 15), 12];
  for (const symbolScale of [1, 0.8]) for (const offset of orientations) {
    const { group } = await makeScene(true, offset, symbolScale);
    let owner = '';
    const objects = [];
    for (const child of group.children) {
      if (child.userData.ref) {
        owner = child.userData.ref;
        objects.push({ owner, name: 'glyph', box: visibleRectangle(child) });
      } else if (child.material?.map?.isCanvasTexture) {
        objects.push({ owner, name: 'degree', box: visibleRectangle(child) });
      }
    }
    for (let i = 0; i < objects.length; i++) for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i], b = objects[j];
      if (a.owner === b.owner) continue;
      assert.ok(overlapArea(a.box, b.box) < 0.00001,
        `scale ${symbolScale}, offset ${offset}: ${a.owner} ${a.name} overlaps ${b.owner} ${b.name} by ${overlapArea(a.box, b.box).toFixed(5)}`);
    }
  }
});

test('wider natal planet ring holds degree badges beside each glyph', async () => {
  const natalInnerRadius = 4.5723 * 67.1 / 120 / 2;
  const natalOuterRadius = 4.5723 * 103 / 120 / 2;
  const scene = await makeScene(true, 0, 1, natalOuterRadius, natalInnerRadius);
  const glyphs = scene.group.children.filter(child => child.userData.ref);
  const badges = scene.group.children.filter(child => child.material?.map?.isCanvasTexture);
  assert.equal(glyphs.length, badges.length);
  for (let i = 0; i < badges.length; i++) {
    const glyph = glyphs[i], label = badges[i];
    const badgeDistance = distance(glyph.position, label.position);
    assert.ok(badgeDistance <= 0.205 * glyph.scale.x / 0.22 + 0.001,
      'degree label should follow its glyph rather than an independent orbit');
    assert.ok(badgeDistance > 0.04, 'degree label must remain distinguishable from its glyph');
  }
  for (const glyph of glyphs) {
    const radius = Math.hypot(glyph.position.x, glyph.position.y);
    assert.ok(radius > natalInnerRadius && radius < natalOuterRadius,
      'glyph must occupy the wider radial band');
  }

  for (const offset of [0, 27, 91, 135, 198, 276, 331]) {
    const { group } = await makeScene(true, offset, 1, natalOuterRadius, natalInnerRadius);
    let owner = '';
    const objects = [];
    for (const child of group.children) {
      if (child.userData.ref) { owner = child.userData.ref; objects.push({owner, box: visibleRectangle(child)}); }
      else if (child.material?.map?.isCanvasTexture) objects.push({owner, box: visibleRectangle(child)});
    }
    for (let i = 0; i < objects.length; i++) for (let j = i + 1; j < objects.length; j++) {
      if (objects[i].owner === objects[j].owner) continue;
      assert.ok(overlapArea(objects[i].box, objects[j].box) < 0.00001,
        `wider natal layout must not overlap, offset ${offset}, ${objects[i].owner} ${JSON.stringify(objects[i].box)} vs ${objects[j].owner} ${JSON.stringify(objects[j].box)}, ${overlapArea(objects[i].box, objects[j].box)}`);
    }
  }
});

test('degree badge collision geometry stays consistent near the wide-band threshold', async () => {
  // The renderer uses the original band width to select large badges; after
  // reserving margins, the effective layout band is narrower than 0.45.
  const { group } = await makeScene(true, 0, 1, 1.95, 1.43);
  let owner = '';
  const objects = [];
  for (const child of group.children) {
    if (child.userData.ref) { owner = child.userData.ref; objects.push({ owner, box: visibleRectangle(child) }); }
    else if (child.material?.map?.isCanvasTexture) {
      objects.push({ owner, box: visibleRectangle(child) });
    }
  }
  for (let i = 0; i < objects.length; i++) for (let j = i + 1; j < objects.length; j++) {
    const a = objects[i], b = objects[j];
    if (a.owner === b.owner) continue;
    assert.ok(overlapArea(a.box, b.box) < 0.00001,
      `${a.owner}/${b.owner}: badge and glyph footprints diverged`);
  }
});

test('planetary degree labels never cover any real-longitude tick on the house boundary', async () => {
  const natalInner = 4.5723 * 67.1 / 120 / 2;
  const natalOuter = 4.5723 * 103 / 120 / 2;
  const dataSets = [
    planetLongitudes,
    {Sun: 358.4, Moon: 359.1, Mercury: 0.3, Venus: 1.2, Mars: 2.4},
    {Sun: 1, Moon: 1.15, Mercury: 1.3, Venus: 1.45,
      Mars: 1.6, Jupiter: 1.75, Saturn: 1.9, Uranus: 2.05},
  ];
  for (const source of dataSets) for (const offset of [0, 30, 60, 90, 145, 210, 270, 315]) {
    const {group} = await makeScene(true, offset, 1, natalOuter, natalInner, source);
    const labels = group.children.filter(child => child.material?.map?.isCanvasTexture);
    const ticks = group.children.filter(child => child.userData.planetHouseTick);
    assert.equal(labels.length, Object.keys(source).length);
    assert.equal(ticks.length, Object.keys(source).length);
    for (const label of labels) for (const tick of ticks) {
      const coords = tick.geometry.attributes.position.array;
      assert.equal(segmentCrossesRectangle(coords, visibleRectangle(label)), false,
        `rotation ${offset}: a degree badge covers ${tick.userData.planetHouseTick}'s house tick`);
    }
  }
});
