import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importTargets, nonLiteralImportLocations } from '../scripts/extraction-imports.mjs';

test('checks actual imports and exports without mistaking comments or strings for dependencies', () => {
  const source = `
    // import { Old } from './missing';
    /* export * from './also-missing'; */
    const example = "import('./not-an-import')";
    import {
      Thing
    } from './thing';
    import 'side-effect';
    export { Other } from './other';
    import legacy = require('legacy');
    const later = import('./later');
  `;
  assert.deepEqual(importTargets(source), ['./thing', 'side-effect', './other', 'legacy', './later']);
});

test('reports computed dynamic imports with stable 1-based locations', () => {
  const source = [
    "const literal = import('./safe');",
    "const computed = import('./' + name);",
    "const template = import(`./${name}`);",
    "// import(variable);",
    "const missing = import();",
    "const sideEffect = import('./ok');",
  ].join('\n');
  assert.deepEqual(importTargets(source), ['./safe', './ok']);
  assert.deepEqual(nonLiteralImportLocations(source), ['2:18', '3:18', '5:17']);
  assert.deepEqual(nonLiteralImportLocations("const sample = \"import(variable)\";"), []);
});
