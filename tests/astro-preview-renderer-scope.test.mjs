import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Check the actual renderer TypeScript call sites; text-regex checks are not
// sufficient because commented-out prototype code contains getImg examples.
const read = path => readFileSync(new URL('../src/lib/renderers/' + path, import.meta.url), 'utf8');

function source(path) {
  return ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}
function visitCalls(path) {
  const file = source(path);
  const calls = [];
  const visit = node => {
    if (ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'getImg' &&
      node.expression.expression.getText(file) === 'OggettiSempliciRender') {
      calls.push({
        at: node.getStart(file),
        source: node.getText(file),
        previewOptIn: node.arguments.length === 7 &&
          node.arguments[6].kind === ts.SyntaxKind.TrueKeyword,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return calls;
}

test('only main natal and synastry zodiac rings explicitly opt into approved glyphs', () => {
  const calls = visitCalls('moduli/segni.renderer.ts');
  assert.equal(calls.length, 4, 'two ring and two decan/decanate calls');
  const enabled = calls.filter(call => call.previewOptIn);
  assert.equal(enabled.length, 2);
  assert.ok(enabled.every(call => call.source.includes('simboli-bianchi/segni/')));
  const unchanged = calls.filter(call => !call.previewOptIn);
  assert.equal(unchanged.length, 2);
  assert.ok(unchanged.some(call => call.source.includes('sequenzaDecani')));
  assert.ok(unchanged.some(call => call.source.includes('simboli-bianchi/segni/')));
});

test('only primary celestial symbols opt in; dodecatemoria remains on legacy rasters', () => {
  const calls = visitCalls('moduli/elementi-celesti.renderer.ts');
  assert.equal(calls.length, 3);
  const enabled = calls.filter(call => call.previewOptIn);
  assert.equal(enabled.length, 1);
  assert.ok(enabled[0].source.includes('coloreSimboli,true'));
  assert.equal(calls.filter(call => !call.previewOptIn).length, 2);
});

test('all other getImg call sites remain unchanged by default', () => {
  const files = [
    'moduli/case.renderer.ts',
    'moduli/aspetti.renderer.ts',
    'moduli/transiti.renderer.ts',
    'moduli/sinastria.renderer.ts',
    '@carta-astrale/latitudini.renderer.ts',
  ];
  for (const path of files) {
    const calls = visitCalls(path);
    assert.ok(calls.every(call => !call.previewOptIn), path);
  }
});

test('the texture and mesh pipeline require explicit opt-in; no global overrides', () => {
  const manager = read('gestore-immagini.ts');
  const objects = read('oggetti-semplici.renderer.ts');
  for (const [label, text] of [
    ['image URL resolver', manager],
    ['texture loadAsync', manager],
    ['geometry getImg', objects],
    ['material getMaterial', objects],
  ]) {
    assert.match(text, /allowAstroPreview = false/, label);
  }
  assert.match(manager, /isVirgoStarsAstroPreviewAsset\(reference: string, allowAstroPreview = false\)/);
  assert.match(manager, /allowAstroPreview && this\.virgoStarsAstroPreviewEnabled/);
  assert.match(objects, /getMaterial\(assetsImgRef, flipY, color, allowAstroPreview\)/);
  assert.match(objects, /loadAsync\('\.\.\/\.\.\/\.\.\/assets\/img\/' \+ assetsImgRef, allowAstroPreview\)/);
});
