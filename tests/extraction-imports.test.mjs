import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importTargets } from '../scripts/extraction-imports.mjs';

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
