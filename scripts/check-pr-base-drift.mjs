#!/usr/bin/env node
/**
 * Read-only local Git check for files changed on both a PR head and its
 * updated target branch since their historical merge-base.
 * This supplements (does not replace) check-pr-overlap.mjs.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_PATH = resolve(fileURLToPath(import.meta.url));
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

function parsePair(input) {
  if (typeof input !== 'string') throw new Error('Expected base:head');
  const parts = input.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1] || parts[0] === parts[1]) {
    throw new Error('Expected two different refs as base:head');
  }
  for (const ref of parts) {
    if (!REF_PATTERN.test(ref) || ref.includes('..') || ref.includes('//') ||
        ref.endsWith('/') || ref.endsWith('.lock') || ref.includes('@{')) {
      throw new Error('Invalid Git ref: ' + ref);
    }
  }
  return { base: parts[0], head: parts[1] };
}

/** Read-only, deterministic for locally resolved commit IDs. No Git fetch. */
export function inspectBaseDrift(pairs, cwd = process.cwd(), runGit = execFileSync) {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new Error('Provide at least one base:head pair');
  }
  const parsed = pairs.map(parsePair);
  if (new Set(pairs).size !== pairs.length) throw new Error('Duplicate base:head pair');
  const git = args => runGit('git', args, {
    cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const commit = ref => git(['rev-parse', '--verify', ref + '^{commit}']).trim();
  const pathsBetween = (from, to) => {
    if (from === to) return [];
    // No rename detection: both removed and added paths must be visible.
    const output = git(['diff', '--no-renames', '--name-only', '-z', from, to, '--']);
    return [...new Set(output.split('\0').filter(Boolean))].sort();
  };
  const branches = parsed.map(({ base, head }) => {
    const baseRevision = commit(base);
    const headRevision = commit(head);
    const mergeBase = git(['merge-base', baseRevision, headRevision]).trim();
    if (!mergeBase) throw new Error('No merge-base for ' + base + ':' + head);
    const baseFiles = pathsBetween(mergeBase, baseRevision);
    const headFiles = pathsBetween(mergeBase, headRevision);
    const baseFileSet = new Set(baseFiles);
    return {
      base, head, baseRevision, headRevision, mergeBase,
      baseAdvanced: baseRevision !== mergeBase,
      baseFiles, headFiles,
      overlappingFiles: headFiles.filter(path => baseFileSet.has(path)),
    };
  });
  const filesNeedingReview = branches.reduce((count, b) => count + b.overlappingFiles.length, 0);
  return {
    schemaVersion: 1,
    source: 'offline-local-git',
    status: filesNeedingReview ? 'BASE_DRIFT_REVIEW_REQUIRED' : 'NO_BASE_DRIFT_OVERLAP',
    branches,
    filesNeedingReview,
    limitations: [
      'Same-file edits are not proof of a merge conflict.',
      'No overlapping filenames does not establish semantic compatibility or test success.',
      'Only local refs are examined; compare reported SHAs with current GitHub PR tips.',
      'Use each stacked PR actual target branch as its base, not always main.',
      'This does not compare separate PR heads; run check-pr-overlap.mjs for that.',
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === TOOL_PATH) {
  try {
    const report = inspectBaseDrift(process.argv.slice(2));
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (report.filesNeedingReview) process.exitCode = 2;
  } catch (error) {
    console.error('PR BASE DRIFT AUDIT FAILED: ' + (error instanceof Error ? error.message : String(error)));
    console.error('Usage: node scripts/check-pr-base-drift.mjs main:feature/a [feature/parent:test/child ...]');
    process.exitCode = 1;
  }
}
