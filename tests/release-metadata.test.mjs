/* Release metadata smoke test: does not assert legal clearance.
 * Copyright (c) 2026 Cesare-ml (VirgoStars project); CPAL-1.0.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('package remains non-publishable until explicit maintainer approval', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.private, true, 'package.json must remain private during release audit');
});

test('CPAL exhibits and project notice retain the required VirgoStars credit', async () => {
  const [license, notice, readme] = await Promise.all([
    read('LICENSE'), read('NOTICE'), read('README.md'),
  ]);
  assert.match(license, /Common Public Attribution License Version 1\.0/);
  assert.match(license, /EXHIBIT B\. Attribution Information/);
  for (const [name, value] of [['LICENSE', license], ['NOTICE', notice]]) {
    assert.match(value, /Powered by VirgoStars/, name);
    assert.match(value, /https:\/\/www\.virgostars\.it\//, name);
  }
  assert.match(readme, /https:\/\/www\.virgostars\.it\//);
});

test('release checklist remains explicitly gated', async () => {
  const checklist = await read('docs/PUBLIC_RELEASE_CHECKLIST.md');
  assert.match(checklist, /NOT CLEARED/i);
  assert.match(checklist, /rights|provenance/i);
});

test('release metadata test is wired into the manual preflight and roadmap is discoverable', async () => {
  const [packageText, readme, agents, roadmap] = await Promise.all([
    read('package.json'), read('README.md'), read('AGENTS.md'),
    read('docs/ROADMAP.md'),
  ]);
  const pkg = JSON.parse(packageText);
  assert.equal(pkg.scripts['test:release-metadata'],
    'node --test tests/release-metadata.test.mjs',
    'release metadata guard must be directly runnable');
  assert.match(pkg.scripts.preflight, /(?:^|\s|&&)npm run test:release-metadata(?:\s|&&|$)/,
    'manual preflight must run the release guard');
  for (const [name, content] of [['README', readme], ['AGENTS', agents]]) {
    assert.match(content, /docs\/ROADMAP\.md/, name + ' must link to the roadmap');
  }
  for (const heading of ['M0', 'M1', 'M2', 'M3', 'M4']) {
    assert.match(roadmap, new RegExp('## ' + heading + ' \\u2014 '),
      'roadmap must retain milestone ' + heading);
  }
  assert.match(roadmap, /PUBLIC_RELEASE_CHECKLIST\.md/);
});

test('Angular demo shows a safe clickable VirgoStars credit at launch', async () => {
  const demo = await read('demo/main.ts');
  // Check the actual Angular template, not only documentation or a comment.
  const template = demo.match(/template:\s*`([\s\S]*?)`\s*\}\)/)?.[1];
  assert.ok(template, 'standalone Angular demo must retain an inline template');
  assert.match(template, /Powered by\s*<a\s+[^>]*href="https:\/\/www\.virgostars\.it\/"[^>]*>VirgoStars<\/a>/,
    'demo must display a clickable VirgoStars credit in its initial UI');
  assert.match(template, /<a\s+[^>]*href="https:\/\/www\.virgostars\.it\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/,
    'external credit link must use safe new-tab attributes');
});
