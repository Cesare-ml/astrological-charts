import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectBranchScopes, parseBranchPair } from '../scripts/check-pr-overlap.mjs';

const cli = fileURLToPath(new URL('../scripts/check-pr-overlap.mjs', import.meta.url));

function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), 'charts-pr-scope-'));
  const git = (...args) => execFileSync('git', args, {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
  const write = (name, value) => {
    if (name.includes('/')) mkdirSync(join(root, name.slice(0, name.lastIndexOf('/'))), {recursive:true});
    writeFileSync(join(root, name), value);
  };
  try {
    git('init', '-q', '--initial-branch=main');
    git('config', 'user.name', 'Synthetic Fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    write('README.md', 'fixture\n');
    write('shared.test.mjs', 'main\n');
    git('add', '.'); git('commit', '-qm', 'synthetic seed');
    const base = git('rev-parse', 'HEAD');
    for (const [branch, file, content] of [
      ['feature/a', 'shared.test.mjs', 'A\n'],
      ['feature/b', 'shared.test.mjs', 'B\n'],
      ['feature/c', 'other.test.mjs', 'C\n'],
    ]) {
      git('checkout', '-qb', branch, 'main');
      write(file, content);
      git('add', '.'); git('commit', '-qm', 'synthetic ' + branch);
    }
    git('checkout', '-q', 'main');
    // A stacked PR uses its feature branch as base, not main.
    git('checkout', '-qb', 'feat/interactions', 'main');
    write('fixture.txt', 'parent\n');
    git('add', '.'); git('commit', '-qm', 'interactive feature');
    for (const [branch, body] of [['test/axis-one','one\n'],['test/axis-two','two\n']]) {
      git('checkout', '-qb', branch, 'feat/interactions');
      write('tests/pilot-axis.browser.test.mjs', body);
      git('add','.');git('commit','-qm','synthetic '+branch);
    }
    git('checkout', '-q', 'main');
    return fn({root, git, base});
  } finally { rmSync(root, {recursive:true,force:true}); }
}

test('parses Git branch target pairs and refuses unsafe refs', () => {
  assert.deepEqual(parseBranchPair('main:fix/canvas'), {base:'main',head:'fix/canvas'});
  assert.deepEqual(parseBranchPair('feat/planet-interactions:test/axis'),
    {base:'feat/planet-interactions',head:'test/axis'});
  for (const value of ['', 'main', 'main:', ':test', 'main:main',
    '--output:branch','main:--oops','main:other..path','main:foo//bar',
    'main:foo@{1}', 'main:foo.lock', 'main:foo/', 'main:foo:bar']) {
    assert.throws(() => parseBranchPair(value), Error, value);
  }
});

test('detects shared source paths and independent branches without modifying checkout', () => fixture(({root,git,base}) => {
  const before = git('rev-parse', 'HEAD');
  const report = inspectBranchScopes(['main:feature/a','main:feature/b','main:feature/c'],root);
  assert.equal(report.currentHead,base);
  assert.equal(report.status,'OVERLAP_REVIEW_REQUIRED');
  assert.equal(report.overlaps.length,1);
  assert.deepEqual(report.overlaps[0].files,['shared.test.mjs']);
  assert.equal(report.clearPairs,2);
  assert.deepEqual(report.branches.map(x=>x.files),
    [['shared.test.mjs'],['shared.test.mjs'],['other.test.mjs']]);
  assert.ok(report.branches.every(x => x.baseRevision === base && x.mergeBase === base));
  assert.equal(report.branches[0].revision, git('rev-parse', 'feature/a'));
  assert.equal(git('rev-parse','HEAD'),before);
  assert.equal(git('status','--porcelain'), '');
}));

test('compares stacked branches against their actual parent rather than main', () => fixture(({root,git}) => {
  const report = inspectBranchScopes([
    'feat/interactions:test/axis-one',
    'feat/interactions:test/axis-two'
  ],root);
  assert.equal(report.overlaps.length,1);
  assert.deepEqual(report.overlaps[0].files,['tests/pilot-axis.browser.test.mjs']);
  assert.deepEqual(report.branches[0].files,['tests/pilot-axis.browser.test.mjs']);
  const parentSha = git('rev-parse', 'feat/interactions');
  assert.equal(report.branches[0].baseRevision, parentSha);
  assert.equal(report.branches[0].mergeBase, parentSha);
  assert.equal(report.branches[0].revision, git('rev-parse','test/axis-one'));
  assert.equal(report.status,'OVERLAP_REVIEW_REQUIRED');
  assert.throws(()=> inspectBranchScopes(['main:test/axis-one','main:test/axis-one'],root), /Repeated/);
}));

test('CLI emits machine-readable JSON, exit 2 for overlaps, 0 for distinct paths', () => fixture(({root}) => {
  const conflict=spawnSync(process.execPath,[cli,'main:feature/a','main:feature/b'],{
    cwd:root,encoding:'utf8'
  });
  assert.equal(conflict.status,2,conflict.stderr);
  assert.equal(JSON.parse(conflict.stdout).overlaps.length,1);
  const noOverlap=spawnSync(process.execPath,[cli,'main:feature/a','main:feature/c'],{
    cwd:root,encoding:'utf8'
  });
  assert.equal(noOverlap.status,0,noOverlap.stderr);
  assert.equal(JSON.parse(noOverlap.stdout).status,'NO_FILE_OVERLAP');
  const out='local-report.json';
  const reported=spawnSync(process.execPath,[cli,'--out',out,
    'feat/interactions:test/axis-one', 'feat/interactions:test/axis-two'],{
      cwd:root,encoding:'utf8'
    });
  assert.equal(reported.status,2,reported.stderr);
  assert.equal(JSON.parse(readFileSync(join(root,out),'utf8')).overlaps.length,1);
  assert.equal(reported.stdout.includes('Report:'),true);
}));

test('fails closed for unknown refs and never calls fetch, checkout, or merge', () => fixture(({root})=> {
  const r=spawnSync(process.execPath,[cli,'main:feature/a','main:missing'],{
    cwd:root,encoding:'utf8'
  });
  assert.equal(r.status,1);
  assert.match(r.stderr,/PR SCOPE AUDIT FAILED/);
  const source=readFileSync(cli,'utf8');
  assert.doesNotMatch(source,/git\(\['(?:fetch|pull|merge|reset|push|checkout)'/i);
  assert.match(source,/\['diff', '--name-only', '-z'/);
  assert.match(source,/\['merge-base', baseRevision, revision\]/);
}));


test('records a moving base tip separately from the historical merge-base', () => fixture(({root,git,base}) => {
  // The head branches were created from the original main, then main advanced.
  // The audit must use the shared ancestor for its diff, but also record the
  // latest base SHA to make a stale/concurrent review detectable.
  writeFileSync(join(root,'README.md'), 'new main commit\n');
  git('add','README.md');
  git('commit','-qm','base advanced independently');
  const newBase = git('rev-parse', 'main');
  assert.notEqual(newBase,base);
  const report = inspectBranchScopes(['main:feature/a','main:feature/c'],root);
  assert.equal(report.status,'NO_FILE_OVERLAP');
  assert.equal(report.branches[0].baseRevision,newBase);
  assert.equal(report.branches[0].mergeBase,base);
  assert.equal(report.branches[1].baseRevision,newBase);
  assert.equal(report.branches[1].mergeBase,base);
  assert.deepEqual(report.branches[0].files,['shared.test.mjs']);
  assert.deepEqual(report.branches[1].files,['other.test.mjs']);
  assert.equal(report.currentHead,newBase);
}));
