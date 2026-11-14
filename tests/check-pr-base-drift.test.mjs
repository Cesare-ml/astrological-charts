import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectBaseDrift } from '../scripts/check-pr-base-drift.mjs';

const cli = fileURLToPath(new URL('../scripts/check-pr-base-drift.mjs', import.meta.url));

function fixture(run) {
  const cwd = mkdtempSync(join(tmpdir(), 'charts-base-drift-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const put = (file, content) => writeFileSync(join(cwd, file), content);
  try {
    git('init', '-q', '--initial-branch=main');
    git('config', 'user.name', 'Synthetic QA');
    git('config', 'user.email', 'qa@example.invalid');
    put('planet name.txt', 'baseline\n');
    put('other.txt', 'baseline\n');
    put('README.md', 'baseline\n');
    git('add', '.'); git('commit', '-qm', 'seed');
    const initial = git('rev-parse', 'HEAD');
    git('checkout', '-qb', 'feature/a');
    put('planet name.txt', 'head version\n');
    git('add', '.'); git('commit', '-qm', 'change a');
    git('checkout', '-q', 'main');
    git('checkout', '-qb', 'feature/b');
    put('other.txt', 'head B\n');
    git('add', '.'); git('commit', '-qm', 'change b');
    git('checkout', '-q', 'main');
    return run({cwd, git, put, initial});
  } finally { rmSync(cwd, { recursive: true, force: true }); }
}

test('fresh base has no drift and audit makes no local changes', () => fixture(({cwd, git, initial}) => {
  const before = git('status', '--porcelain');
  const report = inspectBaseDrift(['main:feature/a', 'main:feature/b'], cwd);
  assert.equal(report.status, 'NO_BASE_DRIFT_OVERLAP');
  assert.equal(report.filesNeedingReview, 0);
  assert.ok(report.branches.every(b => b.baseRevision === initial && b.mergeBase === initial));
  assert.deepEqual(report.branches[0].headFiles, ['planet name.txt']);
  assert.deepEqual(report.branches[0].baseFiles, []);
  assert.equal(git('status', '--porcelain'), before);
}));

test('moving base touching unrelated file does not create a false overlap', () => fixture(({cwd, git, put}) => {
  put('README.md', 'new documentation\n');
  git('add', '.'); git('commit', '-qm', 'change docs on base');
  const report = inspectBaseDrift(['main:feature/a'], cwd);
  assert.equal(report.status, 'NO_BASE_DRIFT_OVERLAP');
  assert.equal(report.branches[0].baseAdvanced, true);
  assert.deepEqual(report.branches[0].baseFiles, ['README.md']);
  assert.deepEqual(report.branches[0].overlappingFiles, []);
}));

test('detects same-path base divergence even when different feature heads do not overlap', () => fixture(({cwd, git, put, initial}) => {
  put('planet name.txt', 'new base version\n');
  git('add', '.'); git('commit', '-qm', 'base changed a');
  const report = inspectBaseDrift(['main:feature/a', 'main:feature/b'], cwd);
  assert.equal(report.status, 'BASE_DRIFT_REVIEW_REQUIRED');
  assert.equal(report.filesNeedingReview, 1);
  assert.notEqual(report.branches[0].baseRevision, initial);
  assert.equal(report.branches[0].mergeBase, initial);
  assert.deepEqual(report.branches[0].overlappingFiles, ['planet name.txt']);
  assert.deepEqual(report.branches[1].overlappingFiles, []);
}));

test('a stacked PR compares against its moving parent, not main', () => fixture(({cwd, git, put}) => {
  git('checkout', '-qb', 'test/child', 'feature/a');
  put('other.txt', 'child edit\n');
  git('add', '.'); git('commit', '-qm', 'child');
  git('checkout', '-q', 'feature/a');
  put('other.txt', 'parent edit after child\n');
  git('add', '.'); git('commit', '-qm', 'parent moved');
  const report = inspectBaseDrift(['feature/a:test/child'], cwd);
  assert.deepEqual(report.branches[0].overlappingFiles, ['other.txt']);
  assert.equal(report.status, 'BASE_DRIFT_REVIEW_REQUIRED');
}));

test('CLI uses structured output and meaningful exit codes', () => fixture(({cwd, git, put}) => {
  let run = spawnSync(process.execPath, [cli, 'main:feature/a'], {cwd, encoding:'utf8'});
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).status, 'NO_BASE_DRIFT_OVERLAP');
  put('planet name.txt', 'edited on main\n');
  git('add', '.'); git('commit', '-qm', 'edit base');
  run = spawnSync(process.execPath, [cli, 'main:feature/a'], {cwd, encoding:'utf8'});
  assert.equal(run.status, 2, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout).branches[0].overlappingFiles, ['planet name.txt']);
  run = spawnSync(process.execPath, [cli, 'main:no-such-branch'], {cwd, encoding:'utf8'});
  assert.equal(run.status, 1);
  assert.match(run.stderr, /PR BASE DRIFT AUDIT FAILED/);
}));

test('rejects malformed or repeated refs and never fetches or checks out', () => fixture(({cwd}) => {
  for (const value of ['main', 'main:', ':head', 'main:main', 'main:--bad',
    'main:foo..bar', 'main:foo//bar', 'main:foo.lock', 'main:foo@{1}',
    'main:foo:bar']) {
    assert.throws(() => inspectBaseDrift([value], cwd), Error, value);
  }
  assert.throws(() => inspectBaseDrift([], cwd), /at least one/);
  assert.throws(() => inspectBaseDrift(['main:feature/a', 'main:feature/a'], cwd), /Duplicate/);
  const source = readFileSync(cli, 'utf8');
  assert.doesNotMatch(source, /git\(\['(?:fetch|pull|merge|reset|push|checkout)'/i);
  assert.match(source, /'--no-renames', '--name-only', '-z'/);
}));
