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
