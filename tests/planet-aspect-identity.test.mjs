import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

// Execute the actual public TypeScript value helpers without Angular/WebGL.
const source = readFileSync(
  new URL('../src/lib/renderers/planet-interaction.types.ts', import.meta.url), 'utf8'
);
const js = ts.transpileModule(source, {compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext
}}).outputText;
const api = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

const first = {
  from: {layer:'natal',name:'Sun|transit:Moon'},
  to: {layer:'transit',name:'Mars'},
  type:'trigono', orb:1
};
const second = {
  from: {layer:'natal',name:'Sun'},
  to: {layer:'transit',name:'Moon|transit:Mars'},
  type:'trigono', orb:2
};

test('two different aspects sharing an ambiguous legacy delimiter key stay distinct', () => {
  const oldKey = link => [
    api.chartPlanetKey(link.from), api.chartPlanetKey(link.to), link.type
  ].join('|');
  assert.equal(oldKey(first), oldKey(second), 'reproduce old delimiter collision');
  assert.notEqual(api.chartAspectRelationKey(first), api.chartAspectRelationKey(second));
  assert.notEqual(api.chartAspectRelationKey(first), api.chartAspectRelationKey({
    ...first, type:'trigono|opposizione'
  }), 'aspect types also participate in identity');
});

test('orb-only changes to distinct delimiter-heavy links can retain existing geometry', () => {
  const previous = [first,second];
  const next = previous.map(link => ({...link,orb:link.orb+0.5}));
  assert.equal(api.sameChartAspects(previous,next),false,
    'changed metadata must still update the frontend');
  assert.equal(api.sameChartAspectVisuals(previous,next),true,
    'two distinct aspects must not masquerade as duplicate strokes');
});

test('true duplicate aspect identities remain on the conservative repaint path', () => {
  const previous = [first,{...first,orb:2}];
  const next = [{...first,orb:1.2},{...first,orb:2.3}];
  assert.equal(api.sameChartAspectVisuals(previous,next),false);
});

test('equal-orb transit guide tie is deterministic for both input orders', () => {
  const alternative = {...first,type:'opposizione',orb:1};
  const selected = api.preferredTransitConnectorAspect(first,alternative);
  const reversed = api.preferredTransitConnectorAspect(alternative,first);
  assert.equal(selected.type,reversed.type);
  assert.deepEqual(api.chartAspectRelationKey(selected),api.chartAspectRelationKey(reversed));
});
