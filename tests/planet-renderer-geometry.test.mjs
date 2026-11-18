import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  stdin: {
    contents: [
      "export { ElementiCelestiRender } from './src/lib/renderers/moduli/elementi-celesti.renderer';",
      "export { OggettiSempliciRender } from './src/lib/renderers/oggetti-semplici.renderer';",
      "export { defaultOpzioniGrafico } from './src/lib/models/opzioni-grafico.model';",
      "export * as THREE from 'three';",
    ].join('\n'),
    resolveDir: process.cwd(),
    sourcefile: 'planet-renderer-test-harness.ts',
    loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022',
});
const { ElementiCelestiRender, OggettiSempliciRender, defaultOpzioniGrafico, THREE } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const planetLongitudes = {
  Sun: 358.51234, Moon: 359.2, Mercury: 0.1, Venus: 1.4,
  Mars: 2.3, Jupiter: 3.1, Saturn: 4.2,
};
const innerRadius = 1.43;
const outerRadius = 1.83;

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

async function makeScene(showDegrees, longitudeOffset = 0, symbolScale = 1,
  outerRingRadius = outerRadius, innerRingRadius = innerRadius, source = planetLongitudes) {
  const originalGetImg = OggettiSempliciRender.getImg;
  const originalGetLinea = OggettiSempliciRender.getLinea;
  const originalDocument = globalThis.document;
  const labels = [];
  const fonts = [];
  try {
    OggettiSempliciRender.getImg = async (ref, width, height, scale) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width * scale, height * scale),
        new THREE.MeshBasicMaterial({ transparent: true }),
      );
      mesh.userData.ref = ref;
      return mesh;
    };
    OggettiSempliciRender.getLinea = (from, to) => {
      const line = new THREE.Group();
      line.userData.connector = {
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
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
    options.settaggi.skin_id = 'light';
    options.settaggi.elementi_celesti = Object.fromEntries(
      Object.keys(source).map(name => [name, { att: true }]),
    );
    if (showDegrees !== undefined) options.mostraGradiElementiCelesti = showDegrees;
    else delete options.mostraGradiElementiCelesti;
    const theme = {
      planets: Object.fromEntries(
        Object.entries(source).map(([name, longitude]) =>
          [name, { longitude: (longitude + longitudeOffset) % 360, longitudeSpeed: 0 }]),
      ),
    };
    const initial = structuredClone(theme);
    const group = await ElementiCelestiRender.getAnelloElementiCelesti(
      theme, 0, [], symbolScale, options, [], [], innerRingRadius * 2, outerRingRadius * 2,
      innerRingRadius * 2, true, false,
    );
    assert.deepEqual(theme, initial, 'renderer must not mutate original positions');
    return { group, labels, fonts };
  } finally {
    OggettiSempliciRender.getImg = originalGetImg;
    OggettiSempliciRender.getLinea = originalGetLinea;
    globalThis.document = originalDocument;
  }
}

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
    const start = polar(90 + longitude, innerRadius + 0.007);
    const end = polar(90 + longitude, innerRadius + 0.060);
    assert.ok(distance({ x: coords[0], y: coords[1] }, start) < 1e-6,
      `${name}: outer house tick must start at the real, not displaced, longitude`);
    assert.ok(distance({ x: coords[3], y: coords[4] }, end) < 1e-6);
    assert.ok(Math.hypot(coords[0], coords[1]) > innerRadius &&
      Math.hypot(coords[3], coords[4]) > innerRadius,
    `${name}: the house tick must not intrude into the house ring`);
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
    assert.ok(Math.abs(size('Jupiter') - 0.23) < 1e-8, 'isolated Jupiter must have the larger size');
    assert.ok(Math.abs(size('Saturn') - 0.23) < 1e-8, 'isolated Saturn must have the larger size');
    for (const name of ['Sun','Moon','Mercury','Venus','Mars']) {
      assert.ok(Math.abs(size(name) - 0.18) < 1e-8,
        `${name} in the conjunction must retain the compact size`);
    }
    const allGlyphs = Object.values(glyphs);
    assert.ok(new Set(allGlyphs.map(mesh => Math.hypot(mesh.position.x, mesh.position.y).toFixed(6))).size <= 2,
      'larger isolated glyphs must not introduce extra planet orbits');
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
