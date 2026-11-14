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
