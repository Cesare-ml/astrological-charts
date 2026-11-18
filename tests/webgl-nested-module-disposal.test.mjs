import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';

// Exercise source-built module methods with synthetic Three.js meshes. These
// failures occur before the parent chart ever receives the unfinished group.
const bundle = await build({
  stdin: {
    contents: [
      "export {CaseRender} from './src/lib/renderers/moduli/case.renderer';",
      "export {SegniRender} from './src/lib/renderers/moduli/segni.renderer';",
      "export {AspettiRender} from './src/lib/renderers/moduli/aspetti.renderer';",
      "export {ElementiCelestiRender} from './src/lib/renderers/moduli/elementi-celesti.renderer';",
      "export {OggettiSempliciRender} from './src/lib/renderers/oggetti-semplici.renderer';",
      "export {disposeSceneResources} from './src/lib/renderers/scene-resources';",
      "export * as THREE from 'three';",
    ].join('\n'),
    resolveDir: process.cwd(),
    sourcefile: 'webgl-nested-module-disposal-harness.ts',
    loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022',
});
const {CaseRender, SegniRender, AspettiRender, ElementiCelestiRender, OggettiSempliciRender,
  disposeSceneResources, THREE} = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const houses = {ascendant: 42, house: Array.from({length: 12}, (_, i) => (42 + i * 30) % 360)};
const options = {
  temaGrafico: 'light',
  mostraTransiti: false, mostraDecani: false, mostraDecadi: false,
  settaggi: {skin_id: 'light', domificazione_selezionata: 'egizia'},
};

async function withMeshes({failImageAt = 0, failLineAt = 0}, run) {
  const methods = ['getImg', 'getCerchio', 'getLinea', 'getSemiArcoGrosso'];
  const originals = methods.map(name => ({name, value: OggettiSempliciRender[name]}));
  const resources = [];
  let imageCount = 0;
  let lineCount = 0;
  function track(object, label) {
    const record = {label, disposed: 0};
    const original = object.dispose.bind(object);
    object.dispose = () => { record.disposed++; original(); };
    resources.push(record);
    return object;
  }
  function mesh(label) {
    const texture = track(new THREE.Texture(), `texture:${label}`);
    const material = track(new THREE.MeshBasicMaterial({map: texture}), `material:${label}`);
    const geometry = track(new THREE.PlaneGeometry(0.1, 0.1), `geometry:${label}`);
    return new THREE.Mesh(geometry, material);
  }
  try {
    OggettiSempliciRender.getImg = async () => {
      imageCount++;
      if (imageCount === failImageAt) throw new Error(`image ${imageCount} failed`);
      return mesh(`image:${imageCount}`);
    };
    OggettiSempliciRender.getCerchio = () => mesh('circle');
    OggettiSempliciRender.getLinea = () => {
      lineCount++;
      if (lineCount === failLineAt) throw new Error(`line ${lineCount} failed`);
      return mesh('line');
    };
    OggettiSempliciRender.getSemiArcoGrosso = () => mesh('arc');
    await run({resources, imageCount: () => imageCount});
  } finally {
    for (const {name, value} of originals) OggettiSempliciRender[name] = value;
  }
}

function assertDisposed(resources) {
  assert.ok(resources.length > 0);
  assert.deepEqual(resources.filter(resource => resource.disposed !== 1), [],
    'all resources created by the unfinished nested module must be released once');
}

test('zodiac ring frees built sectors and lines on failed sign image', async () => {
  await withMeshes({failImageAt: 2}, async ({resources}) => {
    await assert.rejects(
      SegniRender.getAnelloSegni(42, 1, 3.5, 4.6, false, false, false, options),
      /image 2 failed/);
    assert.ok(resources.some(item => item.label === 'geometry:line'));
    assertDisposed(resources);
  });
});

test('decans free their arcs and completed glyphs if a later glyph fails', async () => {
  await withMeshes({failImageAt: 3}, async ({resources}) => {
    await assert.rejects(
      SegniRender.getDecani(45, 1, 3.5, 4.6, false, options),
      /image 3 failed/);
    assert.ok(resources.some(item => item.label === 'geometry:arc'));
    assertDisposed(resources);
  });
});

test('nested decan failure cleans both completed zodiac and unfinished inner group', async () => {
  await withMeshes({failImageAt: 14}, async ({resources}) => {
    await assert.rejects(
      SegniRender.getAnelloSegni(42, 1, 3.5, 4.6, false, true, false,
        {...options, mostraDecani: true}),
      /image 14 failed/);
    assert.ok(resources.some(item => item.label === 'geometry:image:12'));
    assertDisposed(resources);
  });
});

test('nested decade failure also cleans both independent zodiac groups', async () => {
  await withMeshes({failImageAt: 14}, async ({resources}) => {
    await assert.rejects(
      SegniRender.getAnelloSegni(42, 1, 3.5, 4.6, false, false, true,
        {...options, mostraDecadi: true}),
      /image 14 failed/);
    assertDisposed(resources);
  });
});

test('synastry zodiac ring frees previous sign glyphs on image failure', async () => {
  await withMeshes({failImageAt: 2}, async ({resources}) => {
    await assert.rejects(
      SegniRender.getAnelloSegniSinastria(42, 3.5, 4.6, false, {opzioni: options}),
      /image 2 failed/);
    assertDisposed(resources);
  });
});

test('latitude house ring frees completed dividers on an image failure', async () => {
  await withMeshes({failImageAt: 2}, async ({resources}) => {
    await assert.rejects(
      CaseRender.renderAnelloCaseLatitudini(houses, 0.36, 3.67, false, options),
      /image 2 failed/);
    assert.ok(resources.some(item => item.label === 'geometry:line'));
    assertDisposed(resources);
  });
});

test('natal house ring frees all previous dividers on image failure', async () => {
  await withMeshes({failImageAt: 2}, async ({resources}) => {
    await assert.rejects(
      CaseRender.renderAnelloCase(houses, 0, 0.1, 0.36, 0.5, 3.67, false, options),
      /image 2 failed/);
    assert.ok(resources.some(item => item.label === 'geometry:line'));
    assertDisposed(resources);
  });
});

test('synastry house ring cleans previous imagery and dividers on error', async () => {
  await withMeshes({failImageAt: 2}, async ({resources}) => {
    await assert.rejects(
      CaseRender.renderAnelloCaseSinastria(houses, 0, 0.1, 0.36, 0.5, 3.67, false, options),
      /image 2 failed/);
    assertDisposed(resources);
  });
});

test('terms renderer disposes its partial 60-glyph group on early failure', async () => {
  await withMeshes({failImageAt: 3}, async ({resources}) => {
    await assert.rejects(CaseRender.renderTermini({}, 0.1, 1, 0, false, options),
      /image 3 failed/);
    assert.ok(resources.some(item => item.label === 'geometry:image:2'));
    assertDisposed(resources);
  });
});

test('house wrapper owns detached completed case ring while terms await', async () => {
  await withMeshes({failImageAt: 2}, async ({resources}) => {
    const original = CaseRender.renderAnelloCase;
    CaseRender.renderAnelloCase = async () => {
      const child = new THREE.Group();
      child.add(OggettiSempliciRender.getCerchio());
      return child;
    };
    try {
      await assert.rejects(
        CaseRender.getAnelloCaseCartaAstrale({egizia: houses}, 0, 0.1, '',
          {...options, mostraTermini: true}, 0.36, 0.5, 3.67, 1.2, false),
        /image 2 failed/);
      assert.ok(resources.some(item => item.label === 'geometry:circle'));
      assertDisposed(resources);
    } finally {
      CaseRender.renderAnelloCase = original;
    }
  });
});

async function withPlanetLayout(run) {
  const oldGetElements = ElementiCelestiRender.getElementiCelesti;
  const oldGetPositions = ElementiCelestiRender.getRenderPosPianeti;
  const bodies = {
    Sun: {longitude: 20, longitudeSpeed: 1},
    Moon: {longitude: 50, longitudeSpeed: 1},
  };
  try {
    ElementiCelestiRender.getElementiCelesti = () => bodies;
    ElementiCelestiRender.getRenderPosPianeti = () => Object.fromEntries(
      Object.entries(bodies).map(([name, body]) => [name,
        {longitude: body.longitude, radius: 1.25, scale: 1}]));
    const opts = {...options, mostraGradiElementiCelesti: false};
    await run(() => ElementiCelestiRender.getAnelloElementiCelesti(
      {}, 0, [], 1, opts, [], [], 2, 3, 2, true, false));
  } finally {
    ElementiCelestiRender.getElementiCelesti = oldGetElements;
    ElementiCelestiRender.getRenderPosPianeti = oldGetPositions;
  }
}

test('main planetary ring frees earlier glyphs and connectors when next image fails', async () => {
  await withMeshes({failImageAt: 2}, async ({resources}) => {
    await withPlanetLayout(async render => {
      await assert.rejects(render(), /image 2 failed/);
      assert.ok(resources.some(item => item.label === 'geometry:image:1'));
      assert.ok(resources.some(item => item.label === 'geometry:line'));
      assertDisposed(resources);
    });
  });
});

test('main planet glyph pending during connector failure is not orphaned', async () => {
  await withMeshes({failLineAt: 1}, async ({resources}) => {
    await withPlanetLayout(async render => {
      await assert.rejects(render(), /line 1 failed/);
      assert.ok(resources.some(item => item.label === 'geometry:image:1'));
      assertDisposed(resources);
    });
  });
});

test('successful main planet ring keeps its resources until caller disposal', async () => {
  await withMeshes({}, async ({resources}) => {
    await withPlanetLayout(async render => {
      const group = await render();
      assert.ok(group.children.some(child => child.userData.planet === 'Sun'));
      assert.ok(group.children.some(child => child.userData.planet === 'Moon'));
      assert.ok(resources.every(resource => resource.disposed === 0));
      disposeSceneResources(group);
      assertDisposed(resources);
    });
  });
});

test('completed natal and synastry houses and terms retain resources and order', async () => {
  await withMeshes({}, async ({resources}) => {
    const natal = await CaseRender.renderAnelloCase(houses, 0, 0.1, 0.36, 0.5, 3.67, false, options);
    const synastry = await CaseRender.renderAnelloCaseSinastria(houses, 0, 0.1, 0.36, 0.5, 3.67, false, options);
    const combined = await CaseRender.getAnelloCaseCartaAstrale({egizia: houses}, 0, 0.1, '',
      {...options, mostraTermini: true}, 0.36, 0.5, 3.67, 1.2, false);
    assert.equal(combined.children.length, 3);
    assert.equal(combined.children[1].children.length, 60, 'terms remain before the house ring');
    assert.ok(combined.children[2].children.length > 12, 'house ring remains the last layer');
    assert.ok(resources.every(resource => resource.disposed === 0));
    for (const group of [natal, synastry, combined]) disposeSceneResources(group);
    assertDisposed(resources);
  });
});

test('aspect background frees its arc if the solar resonator image fails', async () => {
  await withMeshes({failImageAt: 1}, async ({resources}) => {
    await assert.rejects(
      AspettiRender.getBackgroundAspetti(2.5, options, false), /image 1 failed/);
    assert.ok(resources.some(item => item.label === 'geometry:arc'));
    assertDisposed(resources);
  });
});

test('aspect wheel frees its pre-existing lines when the nested background fails', async () => {
  await withMeshes({failImageAt: 1}, async ({resources}) => {
    const stubs = [
      [ElementiCelestiRender, 'getElementiCelesti', () => []],
      [AspettiRender, 'getAspettiVerso', () => []],
      [AspettiRender, 'getTipiAspetti', () => []],
      [AspettiRender, 'getNodi', () => []],
      [AspettiRender, 'getArchi', () => []],
      [AspettiRender, 'renderArchi', () => {
        const group = new THREE.Group();
        group.add(OggettiSempliciRender.getCerchio());
        return group;
      }],
    ].map(([owner, name, stub]) => ({owner, name, stub, original: owner[name]}));
    try {
      for (const {owner, name, stub} of stubs) owner[name] = stub;
      await assert.rejects(
        AspettiRender.getCerchioAspetti(0, {}, options, 2.5, false),
        /image 1 failed/);
      assert.ok(resources.some(item => item.label === 'geometry:circle'));
      assertDisposed(resources);
    } finally {
      for (const {owner, name, original} of stubs) owner[name] = original;
    }
  });
});

test('successful nested modules retain their resources until caller disposal', async () => {
  await withMeshes({}, async ({resources}) => {
    const zodiac = await SegniRender.getAnelloSegni(42, 1, 3.5, 4.6, false, false, false, options);
    const background = await AspettiRender.getBackgroundAspetti(2.5, options, false);
    const cases = await CaseRender.renderAnelloCaseLatitudini(houses, 0.36, 3.67, false, options);
    assert.ok(resources.every(resource => resource.disposed === 0));
    for (const group of [zodiac, background, cases]) disposeSceneResources(group);
    assertDisposed(resources);
  });
});
