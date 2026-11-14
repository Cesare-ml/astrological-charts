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

test('demo exposes the seven supported skin IDs, without accidental removals', () => {
  assert.deepEqual(Object.keys(SkinManager.skins).sort(), expectedSkins);
});

test('each skin has a usable natal, transit, synastry and latitude configuration', () => {
  for (const id of expectedSkins) {
    const skin = SkinManager.skins[id];
    const context = 'skin ' + id;
    assert.ok(skin && typeof skin === 'object', context);

    nonemptyString(skin.bgColor, context + '.bgColor');
    assert.ok(Array.isArray(skin.elementi), context + '.elementi must be an array');
    assert.equal(skin.elementi.length, 4, context + '.elementi must contain four colors');
    for (const [index, color] of skin.elementi.entries()) {
      nonemptyString(color, context + '.elementi[' + index + ']');
    }

    for (const section of [
      'cerchioAspetti', 'anelloElementiCelesti', 'anelloSegni',
      'anelloCase', 'anelloTransiti',
    ]) {
      assert.ok(skin[section] && typeof skin[section] === 'object', context + '.' + section);
    }

    const aspects = skin.cerchioAspetti;
    for (const key of ['coloreTexture', 'imgRisuonatoreColore']) {
      nonemptyString(aspects[key], context + '.cerchioAspetti.' + key);
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
      nonemptyString(skin[section].coloreLinea, context + '.' + section + '.coloreLinea');
      nonemptyString(skin[section].coloreSimboli, context + '.' + section + '.coloreSimboli');
    }
    nonemptyString(skin.anelloTransiti.coloreLinea, context + '.anelloTransiti.coloreLinea');
    nonemptyString(skin.anelloSegni.coloreTexture, context + '.anelloSegni.coloreTexture');

    const latitude = skin.latitudini?.elementiCelesti;
    assert.ok(latitude && typeof latitude === 'object', context + '.latitudini.elementiCelesti');
    nonemptyString(latitude.coloreGriglia, context + '.latitudini.elementiCelesti.coloreGriglia');
    nonemptyString(latitude.coloreEclittica, context + '.latitudini.elementiCelesti.coloreEclittica');

    for (const section of ['anelloElementiCelesti', 'anelloSegni', 'anelloCase']) {
      const override = skin[section].sinastria;
      if (override == null) continue;
      assert.equal(typeof override, 'object', context + '.' + section + '.sinastria');
      nonemptyString(override.coloreLinea, context + '.' + section + '.sinastria.coloreLinea');
      nonemptyString(override.coloreSimboli, context + '.' + section + '.sinastria.coloreSimboli');
      assertImageFolder(override.coloreImgFolder, context + '.' + section + '.sinastria.coloreImgFolder');
    }
    for (const section of ['anelloElementiCelesti', 'anelloSegni', 'anelloCase', 'anelloTransiti']) {
      assertImageFolder(skin[section].coloreImgFolder, context + '.' + section + '.coloreImgFolder');
    }
  }
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
