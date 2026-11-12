import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('demo onboarding does not describe the publicly readable source as private', () => {
  const demo = readFileSync(new URL('../docs/ANGULAR_DEMO.md', import.meta.url), 'utf8');
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /publicly readable/i);
  assert.match(demo, /publicly readable repository/i);
  assert.doesNotMatch(demo, /access to this private repository/i);
  assert.match(demo, /public visibility does not grant redistribution rights/i);
});


test('demo distinguishes public renderer source from restricted real artwork', () => {
  const demo = readFileSync(new URL('../docs/ANGULAR_DEMO.md', import.meta.url), 'utf8');
  assert.match(demo, /private `astrological-assets` repository/i);
  assert.match(demo, /manifest-verified server/i);
  assert.match(demo, /no font files are included/i);
  assert.match(demo, /not a comparison with an approved production baseline/i);
});

test('package metadata describes public source without implying an approved release', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.description, /public source pending rights audit/i);
  assert.doesNotMatch(pkg.description, /private collaborative/i);
  assert.equal(pkg.private, true, 'npm publishing must remain disabled pending rights review');
});
