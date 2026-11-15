import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Import the actual, dependency-free TypeScript source as ESM, without Angular,
// a browser, private assets, or a mock copy of the skin configuration.
async function importTypeScript(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(javascript).toString('base64'));
}

const { SkinManager } = await importTypeScript('../src/lib/renderers/@skin-manager.ts');
const { resolveChartAssetUrl } = await importTypeScript('../src/lib/renderers/chart-asset-urls.ts');

const expectedSkins = [
  'astrolabio',
  'astrolabio-girasole',
  'dark',
  'dark-bn',
  'light',
  'light-bn',
  'sun',
];

function nonemptyString(value, description) {
  assert.equal(typeof value, 'string', description + ' must be a string');
  assert.ok(value.trim().length > 0, description + ' must not be blank');
}

// The shipped skin palette uses CSS hex and explicit color tokens. Reject typos
// rather than letting Three.js silently substitute black for an unknown color.
function assertSkinColor(value, description, { allowElementi = false } = {}) {
  nonemptyString(value, description);
  const isHex = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
  const isNamed = value === 'white' || value === 'black';
  const isPaletteToken = allowElementi && value === 'elementi';
  assert.ok(isHex || isNamed || isPaletteToken,
    description + ' must be a CSS hex color or a supported skin color token');
}

function imagePath(value, description, { required = false } = {}) {
  if (value == null) {
    assert.ok(!required, description + ' is required for every skin');
    return; // Optional textures may intentionally use flat colors.
  }
  nonemptyString(value, description);
  assert.ok(
    !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value),
    description + ' must use a host-owned asset, not a remote or data URL',
  );
  assert.ok(
    resolveChartAssetUrl(value).startsWith('/assets/img/'),
    description + ' must resolve to a host-owned image',
  );
}

function assertImageFolder(folder, description) {
  if (folder == null) return; // Some skin rings draw colored glyphs instead of images.
  assert.ok(folder === 'bianco' || folder === 'nero',
    description + ' must use an existing white/black glyph directory');
}

// A dynamic texture expression is invisible to the static asset-selector AST
// and can make a supposedly complete synthetic pack omit an active resource.
function assertStaticAssetDeclarations(source) {
  const ast = ts.createSourceFile('skin-manager.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declarations = [];
  function visit(node) {
    if (ts.isPropertyAssignment(node)) {
      const key = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)
        ? node.name.text : null;
      if (key === 'texture' || key === 'imgRisuonatoreSolare') {
        const value = node.initializer;
        const isLiteral = ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value);
        const isOptionalNull = key === 'texture' && value.kind === ts.SyntaxKind.NullKeyword;
        assert.ok(isLiteral || isOptionalNull,
          key + ' must be a literal asset path' + (key === 'texture' ? ' or null' : '') +
          ' for deterministic fixture coverage');
        if (isLiteral) {
          assert.ok(value.text.trim().length > 0, key + ' must not be blank');
          declarations.push({ key, path: value.text });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return declarations;
}

// The renderer's sinastria branches use nullish fallback to each ring's base
// style. An override may supply only the properties it intentionally changes.
function assertSynastryOverrides(skin, context) {
  for (const section of ['anelloElementiCelesti', 'anelloSegni', 'anelloCase']) {
    const override = skin[section].sinastria;
    if (override == null) continue;
    const label = context + '.' + section + '.sinastria';
    assert.ok(typeof override === 'object' && !Array.isArray(override),
      label + ' must be an object when supplied');
    for (const key of ['coloreLinea', 'coloreSimboli', 'coloreTexture']) {
      if (override[key] == null) continue; // ?? falls back to base-ring values.
      assertSkinColor(override[key], label + '.' + key,
        { allowElementi: key === 'coloreSimboli' && section !== 'anelloElementiCelesti' });
    }
    assertImageFolder(override.coloreImgFolder, label + '.coloreImgFolder');
  }
}

test('active skin asset declarations are static paths or optional null textures', () => {
  const source = readFileSync(new URL('../src/lib/renderers/@skin-manager.ts', import.meta.url), 'utf8');
  const paths = assertStaticAssetDeclarations(source);
  assert.ok(paths.some(item => item.key === 'texture'), 'No texture literals found');
  assert.ok(paths.some(item => item.key === 'imgRisuonatoreSolare'), 'No resonator image literals found');

  assert.throws(
    () => assertStaticAssetDeclarations("class Config { static skins = { a: { texture: selectTexture() } }; }"),
    /texture must be a literal asset path or null/,
  );
  assert.throws(
    () => assertStaticAssetDeclarations("class Config { static skins = { a: { imgRisuonatoreSolare: null } }; }"),
    /imgRisuonatoreSolare must be a literal asset path/,
  );
  assert.doesNotThrow(
    () => assertStaticAssetDeclarations("class Config { static skins = { a: { texture: null } }; }"),
  );
});

test('demo exposes the seven supported skin IDs, without accidental removals', () => {
  assert.deepEqual(Object.keys(SkinManager.skins).sort(), expectedSkins);
});

test('each skin has a usable natal, transit, synastry and latitude configuration', () => {
  for (const id of expectedSkins) {
    const skin = SkinManager.skins[id];
    const context = 'skin ' + id;
    assert.ok(skin && typeof skin === 'object', context);

    assertSkinColor(skin.bgColor, context + '.bgColor');
    assert.ok(Array.isArray(skin.elementi), context + '.elementi must be an array');
    assert.equal(skin.elementi.length, 4, context + '.elementi must contain four colors');
    for (const [index, color] of skin.elementi.entries()) {
      assertSkinColor(color, context + '.elementi[' + index + ']');
    }

    for (const section of [
      'cerchioAspetti', 'anelloElementiCelesti', 'anelloSegni',
      'anelloCase', 'anelloTransiti',
    ]) {
      assert.ok(skin[section] && typeof skin[section] === 'object', context + '.' + section);
    }

    const aspects = skin.cerchioAspetti;
    for (const key of ['coloreTexture', 'imgRisuonatoreColore']) {
      assertSkinColor(aspects[key], context + '.cerchioAspetti.' + key);
    }
    if (aspects.monocoloreLineeAspetti != null) {
      assertSkinColor(aspects.monocoloreLineeAspetti, context + '.cerchioAspetti.monocoloreLineeAspetti');
    }
    for (const key of ['imgRisuonatoreSolareWidth', 'imgRisuonatoreSolareHeight', 'imgRisuonatoreScale']) {
      assert.ok(Number.isFinite(aspects[key]) && aspects[key] > 0,
        context + '.cerchioAspetti.' + key + ' must be positive and finite');
    }
    assert.ok(Number.isFinite(aspects.imgRisuonatoreSolareOpacity)
      && aspects.imgRisuonatoreSolareOpacity >= 0
      && aspects.imgRisuonatoreSolareOpacity <= 1,
    context + '.cerchioAspetti.imgRisuonatoreSolareOpacity must be between 0 and 1');

    for (const section of ['anelloElementiCelesti', 'anelloSegni', 'anelloCase']) {
      assertSkinColor(skin[section].coloreLinea, context + '.' + section + '.coloreLinea');
      assertSkinColor(skin[section].coloreSimboli, context + '.' + section + '.coloreSimboli',
        { allowElementi: section !== 'anelloElementiCelesti' });
    }
    assertSkinColor(skin.anelloTransiti.coloreLinea, context + '.anelloTransiti.coloreLinea');
    assertSkinColor(skin.anelloSegni.coloreTexture, context + '.anelloSegni.coloreTexture');

    const latitude = skin.latitudini?.elementiCelesti;
    assert.ok(latitude && typeof latitude === 'object', context + '.latitudini.elementiCelesti');
    assertSkinColor(latitude.coloreGriglia, context + '.latitudini.elementiCelesti.coloreGriglia');
    assertSkinColor(latitude.coloreEclittica, context + '.latitudini.elementiCelesti.coloreEclittica');

    assertSynastryOverrides(skin, context);
    for (const section of ['anelloElementiCelesti', 'anelloSegni', 'anelloCase', 'anelloTransiti']) {
      assertImageFolder(skin[section].coloreImgFolder, context + '.' + section + '.coloreImgFolder');
    }
  }
});

test('partial synastry overrides inherit base styles while validating supplied values', () => {
  const partial = {
    anelloElementiCelesti: { sinastria: { coloreLinea: '#aabbcc' } },
    anelloSegni: { sinastria: { coloreSimboli: 'elementi' } },
    anelloCase: { sinastria: { coloreTexture: '#abc', coloreImgFolder: 'bianco' } },
  };
  assert.doesNotThrow(() => assertSynastryOverrides(partial, 'partial'));
  assert.doesNotThrow(() => assertSynastryOverrides({
    anelloElementiCelesti: { sinastria: null },
    anelloSegni: {},
    anelloCase: { sinastria: {} },
  }, 'fallback'));

  partial.anelloElementiCelesti.sinastria.coloreSimboli = 'elementi';
  assert.throws(
    () => assertSynastryOverrides(partial, 'invalidPlanet'),
    /must be a CSS hex color or a supported skin color token/,
  );
  delete partial.anelloElementiCelesti.sinastria.coloreSimboli;
  partial.anelloCase.sinastria.coloreLinea = 'not-a-color';
  assert.throws(
    () => assertSynastryOverrides(partial, 'invalidColor'),
    /must be a CSS hex color or a supported skin color token/,
  );
  delete partial.anelloCase.sinastria.coloreLinea;
  partial.anelloCase.sinastria = [];
  assert.throws(
    () => assertSynastryOverrides(partial, 'invalidArray'),
    /must be an object when supplied/,
  );
});

test('declared skin image and texture paths remain host-owned and canonical', () => {
  for (const id of expectedSkins) {
    const skin = SkinManager.skins[id];
    imagePath(skin.cerchioAspetti.imgRisuonatoreSolare, id + '.resonator', { required: true });
    imagePath(skin.cerchioAspetti.texture, id + '.aspectTexture');
    for (const section of ['anelloElementiCelesti', 'anelloSegni', 'anelloCase', 'anelloTransiti']) {
      imagePath(skin[section].texture, id + '.' + section + '.texture');
      imagePath(skin[section].sinastria?.texture, id + '.' + section + '.sinastria.texture');
    }
  }
});

test('the contract rejects missing artwork, foreign URLs and unknown glyph directories', () => {
  assert.throws(
    () => imagePath(undefined, 'test.resonator', { required: true }),
    /test\.resonator is required for every skin/,
  );
  assert.throws(
    () => imagePath('https://example.org/remote.png', 'test.resonator', { required: true }),
    /must use a host-owned asset/,
  );
  assert.throws(
    () => imagePath('img/%2e%2e/secret.png', 'test.texture'),
    /Invalid chart asset path/,
  );
  assert.throws(
    () => assertImageFolder('missing-folder', 'test.coloreImgFolder'),
    /must use an existing white\/black glyph directory/,
  );
  assert.throws(
    () => assertSkinColor('blurple', 'test.bgColor'),
    /must be a CSS hex color or a supported skin color token/,
  );
  assert.throws(
    () => assertSkinColor('elementi', 'test.bgColor'),
    /must be a CSS hex color or a supported skin color token/,
  );
  assert.doesNotThrow(() => assertSkinColor('elementi', 'test.segni.coloreSimboli', { allowElementi: true }));
  assert.throws(
    () => assertSkinColor('elementi', 'test.anelloElementiCelesti.coloreSimboli'),
    /must be a CSS hex color or a supported skin color token/,
  );
  assert.throws(
    () => assertSkinColor('#xyzxyz', 'test.coloreLinea'),
    /must be a CSS hex color or a supported skin color token/,
  );
  assert.doesNotThrow(() => assertSkinColor('#abc', 'test.coloreLinea'));
  assert.doesNotThrow(() => imagePath(null, 'test.optionalTexture'));
  assert.doesNotThrow(() => assertImageFolder(null, 'test.optionalFolder'));
});
