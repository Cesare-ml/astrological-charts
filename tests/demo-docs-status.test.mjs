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
  assert.match(demo, /publicly readable.*`Cesare-ml\/astrological-assets`/i);
  assert.match(demo, /Public visibility does not clear individual artwork for redistribution/i);
  assert.match(demo, /npm run verify:pack/);
  assert.match(demo, /integrity check does not grant redistribution rights/i);
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

test('documentation regression check remains wired into the local preflight', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const demo = readFileSync(new URL('../docs/ANGULAR_DEMO.md', import.meta.url), 'utf8');
  assert.equal(pkg.scripts['test:demo-docs'], 'node --test tests/demo-docs-status.test.mjs');
  assert.match(pkg.scripts.preflight, /(?:^|\s)npm run test:demo-docs(?:\s|$)/);
  assert.match(demo, /npm run test:demo-docs/);
  assert.match(demo, /npm run preflight/);
});

test('demo asset scripts require local manifests and never fall back to production URLs', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const demo = readFileSync(new URL('../docs/ANGULAR_DEMO.md', import.meta.url), 'utf8');
  for (const name of ['demo:assets', 'demo:assets:repo', 'demo:preview']) {
    assert.match(pkg.scripts[name], /serve-local-assets\.mjs/);
    assert.match(pkg.scripts[name], /--root\s+\S+/);
    assert.match(pkg.scripts[name], /--manifest\s+\S*approved-assets\.json/);
    assert.doesNotMatch(pkg.scripts[name], /https?:\/\//i);
  }
  assert.match(demo, /No public website is used as a fallback/i);
});

test('local Angular validation runs preflight and both builds in order', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(
    pkg.scripts['verify:angular'],
    'npm run preflight && npm run build:library && npm run build:demo',
    'do not skip preflight or either Angular target'
  );
  assert.doesNotMatch(pkg.scripts['verify:angular'], /(?:deploy|publish|github-actions)/i);
});

test('contributor instructions use the full Angular verification command', () => {
  const guide = readFileSync(new URL('../CONTRIBUTING.md', import.meta.url), 'utf8');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(guide, /npm run verify:angular/);
  assert.equal(pkg.scripts['verify:angular'], 'npm run preflight && npm run build:library && npm run build:demo');
  assert.match(guide, /PASS, FAIL or NOT RUN/);
});


test('agent guidance distinguishes public asset access from redistribution rights', () => {
  const agents = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');
  assert.match(agents, /astrological-assets.*publicly readable/i);
  assert.match(agents, /not cleared for public redistribution/i);
  assert.match(agents, /manifests\/approved-assets\.json/);
  assert.match(agents, /per-file SHA-256/);
  assert.match(agents, /npm run verify:pack/);
  assert.match(agents, /manifest-gated local server/);
  assert.match(agents, /original font is not included/);
  assert.doesNotMatch(agents, /The private `Cesare-ml\/astrological-assets` repository/);
});

test('agent asset policy keeps artwork outside the renderer and blocks production hotlinks', () => {
  const agents = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(agents, /Never copy them into this renderer repository, package output or demo/i);
  assert.match(agents, /Do not silently hotlink the production website/i);
  assert.match(agents, /Repository visibility and a passing integrity check do not establish redistribution rights/i);
  assert.match(pkg.scripts['demo:assets:repo'], /\.\.\/astrological-assets\/public\/assets/);
  assert.match(pkg.scripts['demo:assets:repo'], /\.\.\/astrological-assets\/manifests\/approved-assets\.json/);
  assert.doesNotMatch(pkg.scripts['demo:assets:repo'], /https?:\/\//i);
});


test('README quickstart covers both Angular builds and approved sibling assets', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(readme, /npm run verify:angular/);
  assert.equal(pkg.scripts['verify:angular'], 'npm run preflight && npm run build:library && npm run build:demo');
  assert.match(readme, /npm run verify:pack/);
  assert.match(readme, /npm run demo:assets:repo/);
  assert.match(readme, /per-file SHA-256/);
  assert.match(readme, /do not grant artwork redistribution rights/i);
  assert.match(readme, /Chromium and Firefox/);
  assert.match(readme, /VirgoStars/);
});


test('independent asset checkout guide reflects public access and byte verification', () => {
  const guide = readFileSync(new URL('../docs/INDEPENDENT_ASSETS_REPOSITORY.md', import.meta.url), 'utf8');
  assert.match(guide, /pubblicamente leggibile/i);
  assert.match(guide, /npm run verify:pack/);
  assert.match(guide, /SHA-256/);
  assert.match(guide, /redistribuzione/);
  assert.match(guide, /Font originale escluso/);
  assert.doesNotMatch(guide, /repository privato degli asset|archivio privato/i);
});
