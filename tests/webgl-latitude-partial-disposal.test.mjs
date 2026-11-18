import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';

// Bundle the actual latitude renderer and its shared disposer, then stub only
// the texture/mesh factories: no WebGL context or private artwork is needed.
const bundle = await build({
  stdin: {
    contents: [
      "export {LatitudiniRender} from './src/lib/renderers/@carta-astrale/latitudini.renderer';",
      "export {disposeSceneResources} from './src/lib/renderers/scene-resources';",
      "export {CaseRender} from './src/lib/renderers/moduli/case.renderer';",
      "export {SegniRender} from './src/lib/renderers/moduli/segni.renderer';",
      "export {AspettiRender} from './src/lib/renderers/moduli/aspetti.renderer';",
      "export {OggettiSempliciRender} from './src/lib/renderers/oggetti-semplici.renderer';",
      "export * as THREE from 'three';",
    ].join('\n'),
    resolveDir: process.cwd(),
    sourcefile: 'webgl-latitude-partial-disposal-harness.ts',
    loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022',
});
const {
  LatitudiniRender, disposeSceneResources, CaseRender, SegniRender,
  AspettiRender, OggettiSempliciRender, THREE,
} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const houses = {
  egizia: {
    ascendant: 42,
    house: Array.from({length: 12}, (_, i) => (42 + i * 30) % 360),
  },
};
const planets = {
  Sun: {longitude: 20, latitude: 0, latitudeSpeed: 0},
  Moon: {longitude: 50, latitude: -2.3, latitudeSpeed: -0.02},
};

async function withLatitudeFixtures({failImageAt = 0, failLine = false, transits = false}, run) {
  const originals = [
    [CaseRender, 'getAnelloCaseLatitudini'],
    [SegniRender, 'getAnelloSegni'],
    [AspettiRender, 'getBackgroundAspetti'],
    [OggettiSempliciRender, 'getCerchio'],
    [OggettiSempliciRender, 'getImg'],
    [OggettiSempliciRender, 'getLineaGrossa'],
    [LatitudiniRender.prototype, 'getAnelloElementiCelesti'],
  ].map(([owner, name]) => ({owner, name, original: owner[name]}));
  const originalLatitudeInstance = LatitudiniRender.lr;
  const resources = [];
  let imageCount = 0;

  function track(resource, kind) {
    const record = {kind, disposed: 0};
    const original = resource.dispose.bind(resource);
    resource.dispose = () => { record.disposed++; original(); };
    resources.push(record);
    return resource;
  }
  function mesh(kind) {
    const texture = track(new THREE.Texture(), `texture:${kind}`);
    const material = track(new THREE.MeshBasicMaterial({map: texture}), `material:${kind}`);
    const geometry = track(new THREE.PlaneGeometry(0.1, 0.1), `geometry:${kind}`);
    return new THREE.Mesh(geometry, material);
  }
  function group(kind) {
    const container = new THREE.Group();
    container.userData.kind = kind;
    container.add(mesh(kind));
    return container;
  }

  try {
    CaseRender.getAnelloCaseLatitudini = async () => group('houses');
    SegniRender.getAnelloSegni = async () => group('signs');
    AspettiRender.getBackgroundAspetti = async () => group('background');
    OggettiSempliciRender.getCerchio = () => mesh('grid');
    OggettiSempliciRender.getImg = async () => {
      imageCount++;
      if (failImageAt === imageCount) throw new Error(`image ${imageCount} failed`);
      return mesh(`glyph:${imageCount}`);
    };
    OggettiSempliciRender.getLineaGrossa = () => {
      if (failLine) throw new Error('latitude indicator failed');
      return mesh('indicator');
    };
    const drawPlanets = originals.find(entry => entry.owner === LatitudiniRender.prototype).original;
    LatitudiniRender.prototype.getAnelloElementiCelesti = async function (...args) {
      const result = await drawPlanets.apply(this, args);
      result.userData.kind = args[6] ? 'transits' : 'planets';
      return result;
    };
    LatitudiniRender.lr = new LatitudiniRender();
    const options = {
      temaGrafico: 'light',
      mostraTransiti: transits,
      settaggi: {
        skin_id: 'light', domificazione_selezionata: 'egizia',
        elementi_celesti: {Sun: {att: true}, Moon: {att: true}},
      },
    };
    const theme = {houses, australInversion: false, planets};
    await run({
      resources,
      imageCount: () => imageCount,
      render: () => LatitudiniRender.creaScena(theme, transits ? theme : null, null, options),
    });
  } finally {
    for (const {owner, name, original} of originals) owner[name] = original;
    LatitudiniRender.lr = originalLatitudeInstance;
  }
}

function assertDisposedOnce(resources) {
  assert.ok(resources.length > 0, 'fixture must create GPU resources');
  assert.deepEqual(resources.filter(resource => resource.disposed !== 1), [],
    'all abandoned scene resources must be freed exactly once');
}

test('failed first latitude image releases case, backdrop, signs and the grid', async () => {
  await withLatitudeFixtures({failImageAt: 1}, async ({resources, render}) => {
    await assert.rejects(render(), /image 1 failed/);
    assert.ok(resources.some(resource => resource.kind === 'geometry:signs'));
    assert.ok(resources.some(resource => resource.kind === 'geometry:grid'));
    assertDisposedOnce(resources);
  });
});

test('failed second latitude image also releases previously completed glyph and indicator', async () => {
  await withLatitudeFixtures({failImageAt: 2}, async ({resources, render}) => {
    await assert.rejects(render(), /image 2 failed/);
    assert.ok(resources.some(resource => resource.kind === 'geometry:glyph:1'));
    assert.ok(resources.some(resource => resource.kind === 'geometry:indicator'));
    assertDisposedOnce(resources);
  });
});

test('failed latitude line factory releases the glyph that has already loaded', async () => {
  await withLatitudeFixtures({failLine: true}, async ({resources, render}) => {
    await assert.rejects(render(), /latitude indicator failed/);
    assert.ok(resources.some(resource => resource.kind === 'texture:glyph:1'));
    assertDisposedOnce(resources);
  });
});

test('transit latitude failure releases detached natal and signs groups', async () => {
  await withLatitudeFixtures({transits: true, failImageAt: 3}, async ({resources, render}) => {
    await assert.rejects(render(), /image 3 failed/);
    assert.ok(resources.some(resource => resource.kind === 'geometry:glyph:2'));
    assertDisposedOnce(resources);
  });
});

test('successful latitude chart preserves paint order and live resources until disposal', async () => {
  await withLatitudeFixtures({transits: true}, async ({resources, render}) => {
    const result = await render();
    assert.deepEqual(result.children.map(child => child.userData.kind),
      ['houses', 'background', 'transits', 'signs', 'planets']);
    assert.ok(resources.every(resource => resource.disposed === 0),
      'successful output must remain usable by the render service');
    disposeSceneResources(result);
    assertDisposedOnce(resources);
  });
});
