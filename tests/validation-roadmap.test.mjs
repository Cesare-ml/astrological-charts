import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const roadmap = readFileSync(new URL('../docs/VALIDATION_ROADMAP.md', import.meta.url), 'utf8');

test('validation roadmap references only existing npm scripts', () => {
  const commands = [...roadmap.matchAll(/\bnpm run ([a-z][a-z0-9:_-]*)\b/g)].map((match) => match[1]);
  assert.ok(commands.length > 0, 'roadmap must document executable npm scripts');
  for (const command of commands) {
    assert.ok(Object.hasOwn(packageJson.scripts, command), `missing npm script: ${command}`);
  }
});

test('roadmap keeps build and browser evidence separate', () => {
  assert.match(roadmap, /NOT RUN/);
  assert.match(roadmap, /Chromium and Firefox/);
  assert.match(roadmap, /SHA-256/);
  assert.match(roadmap, /VirgoStars credits/);
  assert.match(roadmap, /without a LICENSE/);
});

test('release gates remain explicitly pending until runtime evidence is recorded', () => {
  for (const gate of ['reproducible local build', 'independent Three.js demo', 'approved assets', 'integration and release decision']) {
    assert.ok(roadmap.includes(gate), `missing validation gate: ${gate}`);
  }
  assert.doesNotMatch(roadmap, /^- \[x\]/gim, 'do not mark validation gates complete without runtime evidence');
  assert.match(roadmap, /npm ci[\s\S]*npm run verify:angular/, 'clean install must precede build verification');
  assert.match(roadmap, /issue #25/, 'independent axis canvas evidence must remain tracked');
  assert.match(roadmap, /issue #5/, 'multi-canvas lifecycle validation must remain tracked');
});
