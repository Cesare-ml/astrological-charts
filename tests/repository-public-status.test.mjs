import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('interaction branch README describes current public visibility without implying reuse rights', () => {
  const readme = read('README.md');
  assert.match(readme, /publicly readable/i);
  assert.match(readme, /source\/third-party rights audit/i);
  assert.doesNotMatch(readme, /this repository remains private|Private collaborative/i);
  assert.match(readme, /production integration/i);
});

test('AI agent instructions preserve public and production boundaries', () => {
  const agents = read('AGENTS.md');
  assert.match(agents, /publicly readable on GitHub/i);
  assert.match(agents, /rights audit is not complete/i);
  assert.doesNotMatch(agents, /repository is PRIVATE/i);
  assert.match(agents, /not used by production/i);
  assert.match(agents, /Never add GitHub Actions/i);
});

test('asset repository is public but file-specific redistribution clearance is not assumed', () => {
  for (const file of ['README.md', 'AGENTS.md']) {
    const document = read(file);
    assert.match(document, /astrological-assets/);
    assert.match(document, /publicly readable/i);
    assert.match(document, /SHA-256 manifest/i);
    assert.match(document, /redistribution/i);
    assert.doesNotMatch(document, /private `Cesare-ml\/astrological-assets` repository/i);
  }
});

test('extraction documentation continues to state public visibility and blocked release gates', () => {
  const status = read('docs/EXTRACTION_STATUS.md');
  assert.match(status, /GitHub PUBLIC/i);
  assert.match(status, /rights audit NOT COMPLETED/i);
  assert.match(status, /production consumers remain unverified/i);
  assert.doesNotMatch(status, /Phase:\s*PRIVATE/i);
});

test('public visibility must not silently enable npm publishing', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.private, true);
  assert.equal(pkg.name, 'grafici-astrologici');
});
