#!/usr/bin/env node
/**
 * Offline, read-only Git file-scope audit of PR branches and stacked PRs.
 * It detects shared changed paths, not Git merge conflicts or test success.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_PATH = resolve(fileURLToPath(import.meta.url));
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export function parseBranchPair(input) {
  if (typeof input !== 'string') throw new Error('Each input must be base:head');
  const colon = input.indexOf(':');
  if (colon < 1 || colon === input.length - 1 || input.indexOf(':', colon + 1) !== -1) {
    throw new Error('Expected exactly base:head, got: ' + input);
  }
  const base = input.slice(0, colon);
  const head = input.slice(colon + 1);
  for (const ref of [base, head]) {
    if (!REF_PATTERN.test(ref) || ref.startsWith('-') || ref.includes('..') ||
        ref.includes('//') || ref.endsWith('/') || ref.endsWith('.lock') ||
        ref.includes('@{')) {
      throw new Error('Unsafe or invalid local Git ref: ' + ref);
    }
  }
  if (base === head) throw new Error('Base and head must differ: ' + input);
  return { base, head };
}

/**
 * Compare each branch against ITS OWN base, not against an arbitrary main.
 * A common filename means review overlap; it does not prove a merge conflict.
 * No checkout, network request, fetch, reset, merge, or repo write occurs.
 */
export function inspectBranchScopes(inputPairs, cwd = process.cwd(), runGit = execFileSync) {
  if (!Array.isArray(inputPairs) || inputPairs.length < 2) {
    throw new Error('Provide at least two local branch pairs (base:head).');
  }
  const pairs = inputPairs.map(parseBranchPair);
  const seen = new Set();
  for (const { base, head } of pairs) {
    const id = JSON.stringify([base, head]);
    if (seen.has(id)) throw new Error('Repeated base:head pair: ' + base + ':' + head);
    seen.add(id);
  }
  const git = args => runGit('git', args, {
    cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']
  });
  const currentHead = git(['rev-parse', '--verify', 'HEAD']).trim();
  const branches = pairs.map(({ base, head }) => {
    // Resolve BOTH refs before diffing. Moving base/head branch tips during
    // parallel development must not silently change the audited snapshot.
    const baseRevision = git(['rev-parse', '--verify', base + '^{commit}']).trim();
    const revision = git(['rev-parse', '--verify', head + '^{commit}']).trim();
    const mergeBase = git(['merge-base', baseRevision, revision]).trim();
    if (!mergeBase) throw new Error('No shared merge-base: ' + base + ':' + head);
    const raw = git(['diff', '--name-only', '-z', mergeBase, revision, '--']);
    const files = [...new Set(raw.split('\0').filter(Boolean))].sort();
    return { base, head, baseRevision, revision, mergeBase, files };
  });
  const overlaps = [];
  let clearPairs = 0;
  for (let a = 0; a < branches.length; a++) {
    const left = branches[a];
    for (let b = a + 1; b < branches.length; b++) {
      const right = branches[b];
      const rightFiles = new Set(right.files);
      const common = left.files.filter(path => rightFiles.has(path));
      if (common.length) {
        overlaps.push({ left: left.base + ':' + left.head,
          right: right.base + ':' + right.head, files: common });
      } else clearPairs++;
    }
  }
  return {
    schemaVersion: 1,
    source: 'offline-local-git',
    currentHead,
    branches,
    overlaps,
    clearPairs,
    status: overlaps.length ? 'OVERLAP_REVIEW_REQUIRED' : 'NO_FILE_OVERLAP',
    limitations: [
      'File-level overlap is not a Git merge-conflict check.',
      'Unshared file paths do not imply semantic compatibility or passing tests.',
      'Only locally fetched refs are evaluated; this tool does not fetch GitHub data.',
      'Report SHAs freeze each comparison; refresh the audit if a base or head branch advances.',
      'A stacked PR must be passed as its actual base:head, not main:head.'
    ]
  };
}

function main(args) {
  const outIndex = args.indexOf('--out');
  let outPath = null;
  if (outIndex !== -1) {
    if (outIndex === args.length - 1 || args.filter(arg => arg === '--out').length !== 1) {
      throw new Error('Use --out <local-report-path> exactly once.');
    }
    outPath = args[outIndex + 1];
    args = args.filter((_, index) => index !== outIndex && index !== outIndex + 1);
  }
  const report = inspectBranchScopes(args);
  const text = JSON.stringify(report, null, 2) + '\n';
  if (outPath) {
    const filename = resolve(outPath);
    mkdirSync(dirname(filename), { recursive: true });
    writeFileSync(filename, text, { flag: 'w' });
    console.log('Report: ' + filename);
  } else process.stdout.write(text);
  if (report.overlaps.length) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === TOOL_PATH) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    console.error('PR SCOPE AUDIT FAILED: ' + (error instanceof Error ? error.message : String(error)));
    console.error('Usage: node scripts/check-pr-overlap.mjs [--out .local/pr-overlap-report.json] main:fix/a main:fix/b feat/branch:test/stack-a');
    process.exitCode = 1;
  }
}
