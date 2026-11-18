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
      "export {MarcatoriAssiRender} from './src/lib/renderers/moduli/marcatori-assi.renderer';",
      "export {SinastriaRender} from './src/lib/renderers/moduli/sinastria.renderer';",
      "export {TransitiRender} from './src/lib/renderers/moduli/transiti.renderer';",
      "export {OggettiSempliciRender} from './src/lib/renderers/oggetti-semplici.renderer';",
      "export {GestoreImmagini} from './src/lib/renderers/gestore-immagini';",
      "export {disposeSceneResources} from './src/lib/renderers/scene-resources';",
      "export * as THREE from 'three';",
    ].join('\n'),
    resolveDir: process.cwd(),
    sourcefile: 'webgl-nested-module-disposal-harness.ts',
    loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022',
});
const {CaseRender, SegniRender, AspettiRender, ElementiCelestiRender, MarcatoriAssiRender,
  SinastriaRender, TransitiRender, OggettiSempliciRender, GestoreImmagini,
  disposeSceneResources, THREE} = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const houses = {ascendant: 42, house: Array.from({length: 12}, (_, i) => (42 + i * 30) % 360)};
const options = {
  temaGrafico: 'light',
  mostraTransiti: false, mostraDecani: false, mostraDecadi: false,
  settaggi: {skin_id: 'light', domificazione_selezionata: 'egizia'},
};

async function withMeshes({failImageAt = 0, failLineAt = 0, mockFatLines = false,
  failFatLineAt = 0}, run) {
  const methods = ['getImg', 'getCerchio', 'getLinea', 'getSemiArcoGrosso',
    'getLineaGrossa', 'getLineaGrossaTratteggiata'];
  const originals = methods.map(name => ({name, value: OggettiSempliciRender[name]}));
  const resources = [];
  let imageCount = 0;
  let lineCount = 0;
  let fatLineCount = 0;
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
    if (mockFatLines) {
      OggettiSempliciRender.getLineaGrossa = () => {
        fatLineCount++;
        if (fatLineCount === failFatLineAt) throw new Error(`fat line ${fatLineCount} failed`);
        return mesh(`fat-line:${fatLineCount}`);
      };
      OggettiSempliciRender.getLineaGrossaTratteggiata = () => mesh('dashed-line');
    }
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

async function withOverrides(overrides, run) {
  const originals = overrides.map(([owner, method]) => [owner, method, owner[method]]);
  try {
    for (const [owner, method, replacement] of overrides) owner[method] = replacement;
    await run();
  } finally {
    for (const [owner, method, original] of originals) owner[method] = original;
  }
}

function syntheticSubgroup() {
  const group = new THREE.Group();
  group.add(OggettiSempliciRender.getCerchio());
  return group;
}

const synastryInput = {houses: {egizia: houses}};
const synastryState = {opzioni: {...options}};
const renderSynastry = () => SinastriaRender.getAnelloSinastria(
  synastryInput, 42, [], synastryState, 2, 3, 3.5, 3.7, 3.4, 4);

test('synastry releases detached house ring when planetary renderer fails', async () => {
  await withMeshes({}, async ({resources}) => {
    await withOverrides([
      [CaseRender, 'getAnelloCaseCartaAstrale', async () => syntheticSubgroup()],
      [ElementiCelestiRender, 'getAnelloElementiCelesti', async () => {
        throw new Error('planet builder failed');
      }],
    ], async () => {
      await assert.rejects(renderSynastry(), /planet builder failed/);
      assertDisposed(resources);
    });
  });
});

test('synastry releases attached planets and detached houses if zodiac rejects', async () => {
  await withMeshes({}, async ({resources}) => {
    await withOverrides([
      [CaseRender, 'getAnelloCaseCartaAstrale', async () => syntheticSubgroup()],
      [ElementiCelestiRender, 'getAnelloElementiCelesti', async () => syntheticSubgroup()],
      [SegniRender, 'getAnelloSegniSinastria', async () => {
        throw new Error('zodiac builder failed');
      }],
    ], async () => {
      await assert.rejects(renderSynastry(), /zodiac builder failed/);
      assertDisposed(resources);
    });
  });
});

test('successful synastry preserves original planet, zodiac, house layering', async () => {
  await withMeshes({}, async ({resources}) => {
    await withOverrides([
      [CaseRender, 'getAnelloCaseCartaAstrale', async () => syntheticSubgroup()],
      [ElementiCelestiRender, 'getAnelloElementiCelesti', async () => syntheticSubgroup()],
      [SegniRender, 'getAnelloSegniSinastria', async () => syntheticSubgroup()],
    ], async () => {
      const group = await renderSynastry();
      assert.equal(group.children.length, 3);
      assert.ok(resources.every(resource => resource.disposed === 0));
      disposeSceneResources(group);
      assertDisposed(resources);
    });
  });
});

test('transit ring releases completed planets if antiscia builder rejects', async () => {
  await withMeshes({}, async ({resources}) => {
    await withOverrides([
      [ElementiCelestiRender, 'getAnelloElementiCelesti', async () => syntheticSubgroup()],
      [TransitiRender, 'getAntisci', async () => { throw new Error('antiscia failed'); }],
    ], async () => {
      await assert.rejects(TransitiRender.getAnelloTransiti({}, 42, [],
        {...options, mostraAntisci: true}, 3, 4, 3, false), /antiscia failed/);
      assertDisposed(resources);
    });
  });
});

const antisciaOptions = {...options, antisci: {Cardinale: true},
  antisciTransitiHover: {nome: 'Sun'}};
const renderAntiscia = () => TransitiRender.getAntisci({}, 42, antisciaOptions, 3, 4, 4, 4.2);

test('antiscia frees axes, three dots and early lines if another line rejects', async () => {
  await withMeshes({mockFatLines: true, failFatLineAt: 3}, async ({resources}) => {
    await withOverrides([
      [ElementiCelestiRender, 'getElementiCelesti', () => ({Sun: {longitude: 20}})],
    ], async () => {
      await assert.rejects(renderAntiscia(), /fat line 3 failed/);
      assert.equal(resources.filter(item => item.label === 'geometry:circle').length, 3);
      assertDisposed(resources);
    });
  });
});

test('successful antiscia retains all markers and lines until caller cleanup', async () => {
  await withMeshes({mockFatLines: true}, async ({resources}) => {
    await withOverrides([
      [ElementiCelestiRender, 'getElementiCelesti', () => ({Sun: {longitude: 20}})],
    ], async () => {
      const group = await renderAntiscia();
      assert.equal(group.children.length, 8);
      assert.ok(resources.every(resource => resource.disposed === 0));
      disposeSceneResources(group);
      assertDisposed(resources);
    });
  });
});

const syntheticHour = {
  dataora: '2026-11-18T12:00:00', alba: '2026-11-18T06:00:00',
  tramonto: '2026-11-18T17:00:00', albaSucc: '2026-11-19T06:00:00',
  dh: {diurne: Array.from({length: 12}, () =>
    ({dataora: '2026-11-18T06:00:00', pianeta: 'Sun'}))},
};
const axisOptions = {...options, mostraNomiAssi: false, mostraGradiAssi: false};

async function withDisposeCounters(run) {
  const oldGeometryDispose = THREE.BufferGeometry.prototype.dispose;
  const oldMaterialDispose = THREE.Material.prototype.dispose;
  const counts = {geometry: 0, material: 0};
  THREE.BufferGeometry.prototype.dispose = function () {
    counts.geometry++;
    return oldGeometryDispose.call(this);
  };
  THREE.Material.prototype.dispose = function () {
    counts.material++;
    return oldMaterialDispose.call(this);
  };
  try {
    await run(counts);
  } finally {
    THREE.BufferGeometry.prototype.dispose = oldGeometryDispose;
    THREE.Material.prototype.dispose = oldMaterialDispose;
  }
}

test('axis marker builder frees prior stems and dots when planetary-hour image fails', async () => {
  await withDisposeCounters(async counts => {
    await withMeshes({failImageAt: 1}, async () => {
      await assert.rejects(MarcatoriAssiRender.creaMarcatori(42, 80, 2,
        axisOptions, {orePlanetarie: syntheticHour}), /image 1 failed/);
      assert.ok(counts.geometry >= 8, 'four axis stems and arrow/dot heads must be disposed');
      assert.ok(counts.material >= 8, 'their line and dot materials must be disposed');
    });
  });
});

test('successful axis markers retain resources until their owner disposes them', async () => {
  await withDisposeCounters(async counts => {
    await withMeshes({}, async ({resources}) => {
      const group = await MarcatoriAssiRender.creaMarcatori(42, 80, 2,
        axisOptions, {orePlanetarie: syntheticHour});
      assert.equal(counts.geometry, 0);
      assert.equal(counts.material, 0);
      assert.ok(group.children.some(child => child.userData.axis === 'planetary-hour-glyph'));
      disposeSceneResources(group);
      assert.ok(counts.geometry >= 8);
      assertDisposed(resources);
    });
  });
});

test('asynchronous texture loader disposes its unreturned texture on error', async () => {
  const texture = new THREE.Texture();
  let disposed = 0;
  const original = texture.dispose.bind(texture);
  texture.dispose = () => { disposed++; original(); };
  await withOverrides([
    [THREE.TextureLoader.prototype, 'load', (_url, _loaded, _progress, error) => {
      queueMicrotask(error);
      return texture;
    }],
  ], async () => {
    await assert.rejects(GestoreImmagini.loadAsync('synthetic/missing.png'),
      /Unable to load chart asset/);
    assert.equal(disposed, 1);
  });
});

test('synchronous loader rejection before returning a texture also disposes it once', async () => {
  const texture = new THREE.Texture();
  let disposed = 0;
  const original = texture.dispose.bind(texture);
  texture.dispose = () => { disposed++; original(); };
  await withOverrides([
    [THREE.TextureLoader.prototype, 'load', (_url, _loaded, _progress, error) => {
      error();
      return texture;
    }],
  ], async () => {
    await assert.rejects(GestoreImmagini.loadAsync('synthetic/missing.png'),
      /Unable to load chart asset/);
    assert.equal(disposed, 1);
  });
});

test('successful texture loading keeps ownership with the returned caller', async () => {
  const texture = new THREE.Texture();
  let disposed = 0;
  const original = texture.dispose.bind(texture);
  texture.dispose = () => { disposed++; original(); };
  await withOverrides([
    [THREE.TextureLoader.prototype, 'load', (_url, loaded) => {
      queueMicrotask(() => loaded(texture));
      return texture;
    }],
  ], async () => {
    assert.equal(await GestoreImmagini.loadAsync('synthetic/ok.png'), texture);
    assert.equal(disposed, 0);
    texture.dispose();
    assert.equal(disposed, 1);
  });
});

test('material setup failure disposes the texture already loaded', async () => {
  const texture = new THREE.Texture();
  let disposed = 0;
  const original = texture.dispose.bind(texture);
  texture.dispose = () => { disposed++; original(); };
  texture.center.set = () => { throw new Error('center setup failed'); };
  await withOverrides([
    [GestoreImmagini, 'loadAsync', async () => texture],
  ], async () => {
    await assert.rejects(OggettiSempliciRender.getMaterial('synthetic/ok.png', true),
      /center setup failed/);
    assert.equal(disposed, 1);
  });
});

test('textured arc releases its geometry if the texture factory rejects', async () => {
  await withDisposeCounters(async counts => {
    await withOverrides([
      [GestoreImmagini, 'getImg', () => { throw new Error('arc texture failed'); }],
    ], async () => {
      assert.throws(() => OggettiSempliciRender.getSemiArcoGrosso(0, 90,
        1, 2, '#ffffff', 'synthetic/arc.png'), /arc texture failed/);
      assert.equal(counts.geometry, 1);
    });
  });
});

test('successful textured arc keeps its map until caller disposal', async () => {
  const texture = new THREE.Texture();
  let disposed = 0;
  const original = texture.dispose.bind(texture);
  texture.dispose = () => { disposed++; original(); };
  await withOverrides([
    [GestoreImmagini, 'getImg', () => texture],
  ], async () => {
    const arc = OggettiSempliciRender.getSemiArcoGrosso(0, 90,
      1, 2, '#ffffff', 'synthetic/arc.png');
    assert.equal(arc.material.map, texture);
    assert.equal(disposed, 0);
    disposeSceneResources(arc);
    assert.equal(disposed, 1);
  });
});

async function withSyntheticFatSegments(failAt, run) {
  let count = 0;
  await withOverrides([
    [OggettiSempliciRender, 'createFatLineGeometry', () => {
      count++;
      if (count === failAt) throw new Error(`segment ${count} failed`);
      return {};
    }],
    [OggettiSempliciRender, 'createFatLine', () => OggettiSempliciRender.getCerchio()],
  ], run);
}

const pointA = new THREE.Vector3(0, 0, 0);
const pointB = new THREE.Vector3(1, 0, 0);

test('dashed fat-line group disposes earlier segments when a later one fails', async () => {
  await withMeshes({}, async ({resources}) => {
    await withSyntheticFatSegments(3, async () => {
      assert.throws(() => OggettiSempliciRender.getLineaGrossaTratteggiata(
        pointA, pointB, '#ffffff', 0.3, 0.1), /segment 3 failed/);
      assert.equal(resources.filter(item => item.label === 'geometry:circle').length, 2);
      assertDisposed(resources);
    });
  });
});

test('dot-and-dash fat-line group also cleans completed segments on failure', async () => {
  await withMeshes({}, async ({resources}) => {
    await withSyntheticFatSegments(3, async () => {
      assert.throws(() => OggettiSempliciRender.getLineaGrossaPuntoLinea(
        pointA, pointB, '#ffffff', 0.3,
        {passo: 0.1, nLinee: 1, nPunti: 2, rateoLineaSpazio: 0.5}), /segment 3 failed/);
      assertDisposed(resources);
    });
  });
});

test('successful dashed and dotted line groups keep segments until disposal', async () => {
  await withMeshes({}, async ({resources}) => {
    await withSyntheticFatSegments(0, async () => {
      const dashed = OggettiSempliciRender.getLineaGrossaTratteggiata(
        pointA, pointB, '#ffffff', 0.3, 0.1);
      const dotted = OggettiSempliciRender.getLineaGrossaPuntoLinea(
        pointA, pointB, '#ffffff', 0.3,
        {passo: 0.1, nLinee: 1, nPunti: 2, rateoLineaSpazio: 0.5});
      assert.ok(dashed.children.length > 1 && dotted.children.length > 1);
      assert.ok(resources.every(resource => resource.disposed === 0));
      disposeSceneResources(dashed);
      disposeSceneResources(dotted);
      assertDisposed(resources);
    });
  });
});

test('arrow-arc builder releases earlier arc and triangle when final line rejects', async () => {
  await withDisposeCounters(async counts => {
    await withMeshes({failLineAt: 1}, async () => {
      assert.throws(() => OggettiSempliciRender.lanciaFrecciaAdArco(
        0, 120, '#ffffff', '#777777', 2, 4), /line 1 failed/);
      assert.ok(counts.geometry >= 2);
      assert.ok(counts.material >= 2);
    });
  });
});

test('successful arrow-arc has original arc, triangle, line paint order', async () => {
  await withMeshes({}, async ({resources}) => {
    const group = OggettiSempliciRender.lanciaFrecciaAdArco(
      0, 120, '#ffffff', '#777777', 2, 4);
    assert.equal(group.children.length, 3);
    assert.ok(group.children[0] instanceof THREE.Line);
    assert.ok(group.children[1] instanceof THREE.Mesh);
    assert.ok(resources.every(resource => resource.disposed === 0));
    disposeSceneResources(group);
    assertDisposed(resources);
  });
});

test('aspect arc failure disposes earlier lines and shared endpoint geometry', async () => {
  await withDisposeCounters(async counts => {
    await withMeshes({mockFatLines: true, failFatLineAt: 2}, async ({resources}) => {
      const nodes = [{name: 'Sun', longitude: 0, y: 1.2},
        {name: 'Moon', longitude: 60, y: 1.2}];
      assert.throws(() => AspettiRender.renderArchi(0, nodes,
        {60: [[0, 1], [0, 1]]}, ['sestile'], {}, 2.4, false), /fat line 2 failed/);
      assert.ok(counts.geometry >= 1, 'endpoint discs must release their shared geometry');
      assertDisposed(resources);
    });
  });
});

test('multi-theme aspect wrapper disposes completed earlier theme on later failure', async () => {
  await withMeshes({}, async ({resources}) => {
    let themeCount = 0;
    const nodes = [{name: 'Sun', longitude: 0, y: 1.2},
      {name: 'Moon', longitude: 60, y: 1.2}];
    await withOverrides([
      [AspettiRender, 'getAspettiVerso', () => []],
      [AspettiRender, 'getTipiAspetti', () => ['sestile']],
      [AspettiRender, 'getNodi', () => nodes],
      [AspettiRender, 'getArchiDoppioTema', () => ({})],
      [AspettiRender, 'renderArchi', () => {
        if (++themeCount === 2) throw new Error('second theme failed');
        return syntheticSubgroup();
      }],
      [ElementiCelestiRender, 'getElementiCelesti', () => ({})],
    ], async () => {
      assert.throws(() => AspettiRender.getCerchioAspettiMultiTema(0,
        [{anello: 'natal', temaRender: {}}, {anello: 'transit', temaRender: {}}],
        {nome: 'Sun', el: {longitude: 0}, rotateOffs: 0, y: 1.2},
        {...options, settaggi: {...options.settaggi, aspetti_orbite: {}}}, 2.4, 3.4, false),
      /second theme failed/);
      assert.equal(themeCount, 2);
      assertDisposed(resources);
    });
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
