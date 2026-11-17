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

async function makeScene(showDegrees) {
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
          [name, { longitude, longitudeSpeed: 0 }]),
      ),
    };
    const initial = structuredClone(theme);
    const group = await ElementiCelestiRender.getAnelloElementiCelesti(
      theme, 0, [], 1, options, [], [], innerRadius * 2, outerRadius * 2,
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
