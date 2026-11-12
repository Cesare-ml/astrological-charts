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
