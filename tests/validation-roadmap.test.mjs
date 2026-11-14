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

test('Angular verification runs preflight and both builds in order', () => {
  const command = packageJson.scripts['verify:angular'];
  assert.equal(typeof command, 'string', 'verify:angular must be an npm script');
  const stages = command.split(/\s*&&\s*/);
  assert.deepEqual(stages, [
    'npm run preflight',
    'npm run build:library',
    'npm run build:demo',
  ], 'verification must fail fast before building the demo');
  assert.match(packageJson.scripts['test:demo'], /node --test tests\/demo-browser\.test\.mjs/);
  assert.match(packageJson.scripts['test:offline'], /node --test tests\/offline-browser\.test\.mjs/);
  assert.match(packageJson.scripts['demo:generate-synthetic'], /--out \.local\/synthetic-pack\b/);
});

test('release roadmap cannot silently bypass the private-package and owner-approval gates', () => {
  assert.equal(packageJson.private, true, 'npm package must stay private until release approval');
  assert.match(roadmap, /explicit owner approval before merge, deployment, npm publication/);
  assert.match(roadmap, /source\/third-party rights audit/);
  assert.match(roadmap, /precomputed astronomical inputs remain owned by the upstream ephemeris\/functions layer/);
  assert.match(roadmap, /project link in the demo/);
  assert.match(packageJson.engines.node, /22\.12\.0/, 'documented Node 22 baseline must remain supported');
  for (const script of Object.keys(packageJson.scripts)) {
    assert.doesNotMatch(script, /^(?:publish|deploy|release)(?::|$)/, `unexpected automatic release script: ${script}`);
  }
});
