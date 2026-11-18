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

async function withMeshes({failImageAt = 0}, run) {
  const methods = ['getImg', 'getCerchio', 'getLinea', 'getSemiArcoGrosso'];
  const originals = methods.map(name => ({name, value: OggettiSempliciRender[name]}));
  const resources = [];
  let imageCount = 0;
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
    OggettiSempliciRender.getLinea = () => mesh('line');
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
