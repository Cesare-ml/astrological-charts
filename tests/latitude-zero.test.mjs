import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Extract and execute the actual renderer method, without importing WebGL,
// Angular, fonts or any private/production chart data.
const path = new URL('../src/lib/renderers/@carta-astrale/latitudini.renderer.ts', import.meta.url);
const source = ts.createSourceFile('latitudini.renderer.ts', readFileSync(path, 'utf8'),
  ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
const renderer = source.statements.find(node =>
  ts.isClassDeclaration(node) && node.name?.text === 'LatitudiniRender');
assert.ok(renderer, 'LatitudiniRender class not found');
const method = renderer.members.find(node =>
  ts.isMethodDeclaration(node) && node.name.getText(source) === 'getElementiCelesti');
assert.ok(method?.body, 'LatitudiniRender.getElementiCelesti method not found');

const isolatedClass = `export class LatitudeSelectionProbe { ${method.getText(source)} }`;
const output = ts.transpileModule(isolatedClass, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { LatitudeSelectionProbe } = await import(
  'data:text/javascript;base64,' + Buffer.from(output).toString('base64')
);

test('latitude renderer keeps zero, negative zero and finite positive/negative latitudes', async () => {
  const planets = {
    Sun: { latitude: 0, longitude: 15 },
    Moon: { latitude: -0, longitude: 45 },
    Mercury: { latitude: -2.5, longitude: 75 },
    Venus: { latitude: 3.2, longitude: 105 },
    Mars: { latitude: 1, longitude: 135 },
    Ceres: { latitude: Number.MIN_VALUE },
    Eris: { latitude: -Number.MIN_VALUE },
    Jupiter: { latitude: null },
    Saturn: { latitude: undefined },
    Uranus: { latitude: Number.NaN },
    Neptune: { latitude: Number.POSITIVE_INFINITY },
    Chiron: { latitude: Number.NEGATIVE_INFINITY },
    Pluto: { latitude: '0' },
  };
  const enabled = Object.fromEntries(Object.keys(planets).map(name => [name, {att: name !== 'Mars'}]));
  const options = { settaggi: { elementi_celesti: enabled } };
  const selected = await new LatitudeSelectionProbe().getElementiCelesti({planets}, options);
  assert.deepEqual(Object.keys(selected), ['Sun', 'Moon', 'Mercury', 'Venus', 'Ceres', 'Eris']);
  assert.equal(selected.Sun, planets.Sun, 'zero latitude must preserve the source body');
  assert.equal(selected.Moon, planets.Moon, 'negative zero latitude must be valid');
  assert.equal(selected.Ceres, planets.Ceres, 'smallest positive finite latitude must remain valid');
  assert.equal(selected.Eris, planets.Eris, 'smallest negative finite latitude must remain valid');
  assert.ok(!Object.hasOwn(selected, 'Mars'), 'disabled body must stay hidden');
});

test('missing planets are ignored while finite latitude zero remains selectable', async () => {
  const planets = { Sun: { latitude: 0 }, Venus: { latitude: 0 } };
  const options = { settaggi: { elementi_celesti: {
    Moon: {att:true}, Sun: {att:false}, Venus: {att:true},
  } } };
  const selected = await new LatitudeSelectionProbe().getElementiCelesti({planets}, options);
  assert.deepEqual(Object.keys(selected), ['Venus']);
});
