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

test('natal and transit latitude scenes both invoke the shared finite-latitude selector', () => {
  const methodNamed = name => renderer.members.find(node =>
    ts.isMethodDeclaration(node) && node.name?.getText(source) === name);
  const scene = methodNamed('creaScena');
  const ring = methodNamed('getAnelloElementiCelesti');
  assert.ok(scene?.body, 'latitude scene builder must remain present');
  assert.ok(ring?.body, 'latitude ring builder must remain present');

  const callsNamed = (body, methodName) => {
    const calls = [];
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === methodName) calls.push(node);
      ts.forEachChild(node, visit);
    }
    visit(body);
    return calls;
  };

  const ringCalls = callsNamed(scene.body, 'getAnelloElementiCelesti');
  assert.deepEqual(ringCalls.map(call => [
    call.arguments[0]?.getText(source),
    call.arguments.at(-1)?.getText(source),
  ]), [
    ['temaRender', 'false'],
    ['temaRenderTransiti', 'true'],
  ], 'the same ring builder must serve natal and transit themes');

  const selectorCalls = callsNamed(ring.body, 'getElementiCelesti');
  assert.deepEqual(selectorCalls.map(call => call.arguments.map(arg => arg.getText(source))),
    [['temaRender', 'opzioni']],
    'both rings must use the real latitude selector rather than bypassing its finite-value filter');
});

test('transit PNG baseline filters only the Sun and preserves the transit ring', () => {
  // A null transit theme removes the whole ring/grid and can make a missing
  // 0° symbol look visible in a pixel-diff test. Guard against that mistake.
  const fixture = ts.createSourceFile('latitude-zero-render-harness.ts',
    readFileSync(new URL('./fixtures/latitude-zero-render-harness.ts', import.meta.url), 'utf8'),
    ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const events = [];
  let transitsEnabled = false;
  let sameThemePassedToRing = false;
  function visit(node) {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const target = node.left.getText(fixture);
      if (target === 'transitTheme.planets.Sun.latitude') {
        events.push(`latitude:${node.right.getText(fixture)}`);
      } else if (target === 'transitOptions.mostraTransiti') {
        transitsEnabled = node.right.getText(fixture) === 'true';
      }
    }
    if (ts.isVariableDeclaration(node)) {
      const name = node.name.getText(fixture);
      if (name === 'renderTransit') {
        const arrow = node.initializer;
        sameThemePassedToRing = ts.isArrowFunction(arrow)
          && ts.isCallExpression(arrow.body)
          && arrow.body.arguments[1]?.getText(fixture) === 'transit';
      }
      if (['transitZeroSun', 'transitFilteredSun', 'transitShiftedSun'].includes(name)) {
        const call = ts.isAwaitExpression(node.initializer) ? node.initializer.expression : null;
        events.push(`render:${name}:${ts.isCallExpression(call) ?
          call.arguments[0]?.getText(fixture) : 'not-a-call'}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(fixture);
  assert.equal(transitsEnabled, true, 'transit ring must remain enabled for every comparison');
  assert.equal(sameThemePassedToRing, true, 'the same passed theme must feed all transit renders');
  assert.deepEqual(events, [
    'latitude:0', 'render:transitZeroSun:transitTheme',
    'latitude:Number.NaN', 'render:transitFilteredSun:transitTheme',
    'latitude:2', 'render:transitShiftedSun:transitTheme',
  ], 'only the transit Sun latitude may vary across the three PNG controls');
});
