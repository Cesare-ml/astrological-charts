import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundle = await build({
  stdin: {
    contents: [
      "export { LatitudiniRender } from './src/lib/renderers/@carta-astrale/latitudini.renderer';",
      "export { OggettiSempliciRender } from './src/lib/renderers/oggetti-semplici.renderer';",
      "export * as THREE from 'three';",
    ].join('\n'),
    resolveDir: process.cwd(),
    sourcefile: 'latitude-zero-sun-harness.ts',
    loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022',
});
const { LatitudiniRender, OggettiSempliciRender, THREE } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

function fixture() {
  return {
    theme: {
      planets: {
        Sun: { longitude: 20, latitude: 0, latitudeSpeed: 0 },
        Moon: { longitude: 50, latitude: -2.3, latitudeSpeed: -0.02 },
        Mercury: { longitude: 70, latitude: 0, latitudeSpeed: 0.01 },
        Venus: { longitude: 90, latitude: Number.NaN, latitudeSpeed: 0.01 },
        Mars: { longitude: 110, latitudeSpeed: 0.01 },
      },
    },
    options: {
      temaGrafico: 'light',
      settaggi: {
        skin_id: 'light',
        elementi_celesti: {
          Sun: { att: true }, Moon: { att: true }, Mercury: { att: false },
          Venus: { att: true }, Mars: { att: true },
        },
      },
    },
  };
}

test('latitude filter retains Sun at 0° but rejects invalid and disabled bodies', async () => {
  const renderer = new LatitudiniRender();
  const { theme, options } = fixture();
  const visible = await renderer.getElementiCelesti(theme, options);
  assert.deepEqual(Object.keys(visible), ['Sun', 'Moon']);
  assert.equal(visible.Sun.latitude, 0);
  assert.equal(visible.Moon.latitude, -2.3);
});

test('Sun glyph at latitude 0° is rendered on the ecliptic circle', async () => {
  const { theme, options } = fixture();
  const originalGetImg = OggettiSempliciRender.getImg;
  const originalGetLineaGrossa = OggettiSempliciRender.getLineaGrossa;
  const previousInstance = LatitudiniRender.lr;
  const eclipticDiameter = 2.017;
  try {
    LatitudiniRender.lr = new LatitudiniRender();
    OggettiSempliciRender.getImg = async path => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial());
      mesh.userData.assetPath = path;
      return mesh;
    };
    // Fat-line thickness depends on canvas dimensions; this test targets the
    // celestial glyph geometry and does not initialize a browser canvas.
    OggettiSempliciRender.getLineaGrossa = () => new THREE.Group();
    const group = await LatitudiniRender.lr.getAnelloElementiCelesti(
      theme, 0, options, 0.36, 3.67, eclipticDiameter, false,
    );
    const glyphs = group.children.filter(child => child.userData.assetPath);
    assert.equal(glyphs.length, 2);
    const sun = glyphs.find(child => child.userData.assetPath.endsWith('/Sun.png'));
    assert.ok(sun, 'Sun glyph must be present in the latitude chart');
    assert.ok(Math.abs(sun.position.length() - eclipticDiameter / 2) < 1e-8,
      'Sun at zero latitude must lie exactly on the ecliptic');
  } finally {
    OggettiSempliciRender.getImg = originalGetImg;
    OggettiSempliciRender.getLineaGrossa = originalGetLineaGrossa;
    LatitudiniRender.lr = previousInstance;
  }
});
