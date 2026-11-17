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
  Sun: 358.5, Moon: 359.2, Mercury: 0.1, Venus: 1.4,
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

async function makeScene(showDegrees, longitudeOffset = 0, symbolScale = 1, outerRingRadius = outerRadius) {
  const originalGetImg = OggettiSempliciRender.getImg;
  const originalGetLinea = OggettiSempliciRender.getLinea;
  const originalDocument = globalThis.document;
  const labels = [];
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
              fillText(value) { canvas.testLabel = value; labels.push(value); },
            };
          },
        };
        return canvas;
      },
    };
    const options = structuredClone(defaultOpzioniGrafico);
    options.settaggi.skin_id = 'light';
    options.settaggi.elementi_celesti = Object.fromEntries(
      Object.keys(planetLongitudes).map(name => [name, { att: true }]),
    );
    if (showDegrees !== undefined) options.mostraGradiElementiCelesti = showDegrees;
    else delete options.mostraGradiElementiCelesti;
    const theme = {
      planets: Object.fromEntries(
        Object.entries(planetLongitudes).map(([name, longitude]) =>
          [name, { longitude: (longitude + longitudeOffset) % 360, longitudeSpeed: 0 }]),
      ),
    };
    const initial = structuredClone(theme);
    const group = await ElementiCelestiRender.getAnelloElementiCelesti(
      theme, 0, [], symbolScale, options, [], [], innerRadius * 2, outerRingRadius * 2,
      innerRadius * 2, true, false,
    );
    assert.deepEqual(theme, initial, 'renderer must not mutate original positions');
    return { group, labels };
  } finally {
    OggettiSempliciRender.getImg = originalGetImg;
    OggettiSempliciRender.getLinea = originalGetLinea;
    globalThis.document = originalDocument;
  }
}

test('Three.js scene keeps every glyph connector anchored at the true degree', async () => {
  const { group, labels } = await makeScene(true);
  const names = Object.keys(planetLongitudes);
  const glyphs = group.children.filter(child => child.userData.ref);
  const lines = group.children.filter(child => child.userData.connector);
  const numberLabels = group.children.filter(child =>
    child.material?.map?.isCanvasTexture);
  assert.equal(glyphs.length, names.length);
  assert.equal(lines.length, names.length * 2);
  assert.equal(numberLabels.length, names.length);
  assert.deepEqual(labels.sort(), ['0°', '1°', '2°', '28°', '29°', '3°', '4°'].sort());
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
    const anchor = polar(90 + longitude, innerRadius);
    assert.ok(lines.some(line =>
      distance(line.userData.connector.to, anchor) < 1e-8), `${name} must have a true-degree inner anchor`);
    const outerAnchor = polar(90 + longitude, outerRadius);
    assert.ok(lines.some(line =>
      distance(line.userData.connector.to, outerAnchor) < 1e-8), `${name} must have a true-degree outer anchor`);
    const glyphRadius = Math.hypot(glyph.position.x, glyph.position.y);
    assert.ok(glyphRadius > innerRadius && glyphRadius < outerRadius, `${name} outside ring`);
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

test('wider natal planet ring keeps the degrees in a separate strip toward houses', async () => {
  const natalOuterRadius = 4.5723 * 103 / 120 / 2;
  const scene = await makeScene(true, 0, 1, natalOuterRadius);
  const glyphs = scene.group.children.filter(child => child.userData.ref);
  const badges = scene.group.children.filter(child => child.material?.map?.isCanvasTexture);
  assert.equal(glyphs.length, badges.length);
  for (const label of badges) {
    const radius = Math.hypot(label.position.x, label.position.y);
    assert.ok(radius > innerRadius + 0.03 && radius < innerRadius + 0.10,
      'label must be on the inner band, immediately outside the house ring');
    assert.ok(label.geometry.parameters.width >= 0.21 && label.geometry.parameters.height >= 0.13,
      'degree labels in the natal band must be visibly larger');
  }
  for (const glyph of glyphs) {
    const radius = Math.hypot(glyph.position.x, glyph.position.y);
    assert.ok(radius > innerRadius + 0.15 && radius < natalOuterRadius,
      'glyph must occupy a separate radial orbit outside the degree band');
  }

  for (const offset of [0, 27, 91, 135, 198, 276, 331]) {
    const { group } = await makeScene(true, offset, 1, natalOuterRadius);
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
