import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectWebGLBenchmarkProvenance} from '../scripts/webgl-benchmark-provenance.mjs';

const cwd = mkdtempSync(join(tmpdir(), 'virgostars-webgl-provenance-'));
const manifest = join(cwd, '.local', 'demo-pack', 'manifests', 'approved-assets.json');
mkdirSync(join(cwd, '.local', 'demo-pack', 'manifests'), {recursive: true});
writeFileSync(manifest, '{"synthetic":true,"files":[]}', 'utf8');
after(() => rmSync(cwd, {recursive: true, force: true}));

const revision = 'a'.repeat(40);
const stubGit = (args) => args[0] === 'rev-parse' ? revision + '\n' : '';

test('hashes the actual local manifest bytes and records a clean revision', () => {
  const p = collectWebGLBenchmarkProvenance({cwd, runGit: stubGit});
  assert.deepEqual(p, {
    sourceRevision: revision, sourceDirty: false,
    assetManifestSha256: createHash('sha256').update('{"synthetic":true,"files":[]}').digest('hex'),
  });
});

test('different manifest bytes yield distinct reproducible digests', () => {
  const second = join(cwd, 'approved-other.json');
  writeFileSync(second, '{"synthetic":true,"files":[1]}');
  const a = collectWebGLBenchmarkProvenance({cwd, runGit: stubGit});
  const b = collectWebGLBenchmarkProvenance({cwd, manifestPath: second, runGit: stubGit});
  assert.notEqual(a.assetManifestSha256, b.assetManifestSha256);
  assert.match(b.assetManifestSha256, /^[a-f0-9]{64}$/);
});

test('dirty tracked Git state is reported without storing paths or diffs', () => {
  const p = collectWebGLBenchmarkProvenance({cwd, runGit: args => args[0] === 'rev-parse'
    ? revision : ' M src/whatever.ts\n'});
  assert.equal(p.sourceDirty, true);
  assert.equal(JSON.stringify(p).includes('whatever.ts'), false);
});

test('unavailable Git produces unknown rather than clean metadata', () => {
  const p = collectWebGLBenchmarkProvenance({cwd, runGit() { throw Error('git missing'); }});
  assert.equal(p.sourceRevision, null);
  assert.equal(p.sourceDirty, null);
  assert.ok(p.assetManifestSha256);
});

test('bad Git revision never reports a clean checkout', () => {
  const p = collectWebGLBenchmarkProvenance({cwd, runGit() { return 'not-a-sha'; }});
  assert.equal(p.sourceRevision, null);
  assert.equal(p.sourceDirty, null);
});

test('missing implicit manifest is unknown, explicit missing manifest is an error', () => {
  const empty = mkdtempSync(join(tmpdir(), 'virgostars-webgl-empty-'));
  try {
    const p = collectWebGLBenchmarkProvenance({cwd: empty, runGit: stubGit});
    assert.equal(p.assetManifestSha256, null);
    assert.throws(() => collectWebGLBenchmarkProvenance({cwd: empty,
      manifestPath: join(empty, 'missing.json'), runGit: stubGit}), /ENOENT/);
  } finally { rmSync(empty, {recursive: true, force: true}); }
});

test('oversized, empty and non-file manifest paths are rejected', () => {
  const tooBig = join(cwd, 'too-big.json');
  writeFileSync(tooBig, ' '.repeat(5_000_001));
  assert.throws(() => collectWebGLBenchmarkProvenance({cwd, manifestPath: tooBig,
    runGit: stubGit}), /at most 5 MB/);
  const empty = join(cwd, 'empty.json');
  writeFileSync(empty, '');
  assert.throws(() => collectWebGLBenchmarkProvenance({cwd, manifestPath: empty,
    runGit: stubGit}), /nonempty file/);
  assert.throws(() => collectWebGLBenchmarkProvenance({cwd, manifestPath: cwd,
    runGit: stubGit}), /nonempty file/);
});
