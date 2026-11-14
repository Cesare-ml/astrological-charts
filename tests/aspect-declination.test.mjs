import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');

// Execute the production class methods, isolated from their Three.js/Angular imports.
// The test does not replicate the aspect-matching algorithm in a fixture.
const file = new URL('../src/lib/renderers/moduli/aspetti.renderer.ts', import.meta.url);
const code = readFileSync(file, 'utf8');
const ast = ts.createSourceFile(file.pathname, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const renderer = ast.statements.find((node) =>
  ts.isClassDeclaration(node) && node.name?.text === 'AspettiRender'
);
assert.ok(renderer, 'AspettiRender class must exist');

const methods = ['getArchi', 'getArchiDoppioTema'];
const declarations = methods.map((name) => {
  const method = renderer.members.find((member) =>
    ts.isMethodDeclaration(member) && member.name.getText(ast) === name
  );
  assert.ok(method, `AspettiRender.${name} must exist`);
  return method.getText(ast);
});

const compiled = ts.transpileModule(
  `class AspectProbe { ${declarations.join('\n')} }`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }
).outputText;

const AspectProbe = vm.runInNewContext(
  `${compiled}\nAspectProbe;`,
  { Settaggi: { aspetti: {
    congiunzione: { g: 0 },
    parallelodideclinazione: { g: -1 },
    antiparallelo: { g: -2 },
  } } },
);

function node(name, longitude, declination) {
  return {
    name, longitude, orb: 6,
    ...(declination === undefined ? {} : { declinazione: declination }),
  };
}

function countMatches(method, aspect, first, second) {
  const aspects = [aspect];
  const enabled = ['Sun', 'Moon'];
  const orbs = {};
  const arcs = method === 'getArchi'
    ? AspectProbe.getArchi([first, second], aspects, enabled, orbs)
    : AspectProbe.getArchiDoppioTema([first], [second], aspects, enabled, orbs);
  const angles = { congiunzione: 0, parallelodideclinazione: -1, antiparallelo: -2 };
  return arcs[angles[aspect]]?.length ?? 0;
}

for (const method of methods) {
  test(`${method}: nearby longitude without declination is not a parallel`, () => {
    const a = node('Sun', 10, undefined);
    const b = node('Moon', 12, undefined);
    assert.equal(countMatches(method, 'parallelodideclinazione', a, b), 0);
    assert.equal(countMatches(method, 'antiparallelo', a, b), 0);
  });

  test(`${method}: nearby longitudes with opposite declinations are antiparallel only`, () => {
    const a = node('Sun', 10, 12);
    const b = node('Moon', 12, -12.4);
    assert.equal(countMatches(method, 'parallelodideclinazione', a, b), 0);
    assert.equal(countMatches(method, 'antiparallelo', a, b), 1);
  });

  test(`${method}: widely separated longitudes with similar declinations are parallel only`, () => {
    const a = node('Sun', 10, 12);
    const b = node('Moon', 170, 12.4);
    assert.equal(countMatches(method, 'parallelodideclinazione', a, b), 1);
    assert.equal(countMatches(method, 'antiparallelo', a, b), 0);
  });

  test(`${method}: declinations one degree apart remain outside the strict threshold`, () => {
    const a = node('Sun', 10, 12);
    const b = node('Moon', 12, 13);
    assert.equal(countMatches(method, 'parallelodideclinazione', a, b), 0);
  });

  test(`${method}: ordinary longitude conjunction remains supported`, () => {
    const a = node('Sun', 10, undefined);
    const b = node('Moon', 12, undefined);
    assert.equal(countMatches(method, 'congiunzione', a, b), 1);
  });
}
