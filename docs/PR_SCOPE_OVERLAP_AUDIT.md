# Offline PR overlap audit

This tool prevents duplicate file-scoped work from being integrated blindly into `astrological-charts`. It runs **only against locally available Git refs** and does not contact GitHub, check out another branch, merge, reset, modify source files or require any production access.

## Quick start

Fetch the specific PR branches you want to compare into distinct local refs using Git or Codex. Keep this fetch separate from the audit; the audit itself is offline.

```powershell
node scripts/check-pr-overlap.mjs --out .local/pr-overlap-report.json `
  main:fix/windows-full-verify-report-20261112 `
  main:fix/local-asset-server-host-header-20261112
```

The first example compares two independent PRs targeting `main`. For stacked PRs such as #27 and #28, use the actual parent feature branch as their base:

```powershell
node scripts/check-pr-overlap.mjs --out .local/pr-overlap-report.json `
  feat/planet-interactions-transit-aspects-20261110:agent/wave2-axis-canvas-b0dbee66 `
  feat/planet-interactions-transit-aspects-20261110:test/pilot-natal-axis-canvas-20261112-1704
```

For a permanent workflow use the explicit actual branch names/ref SHAs retrieved from GitHub at the time of review. The command requires **at least two** base:head pairs; the branch refs must be available locally and correctly match each PR's target base.

## Report and return codes

The tool checks each pair using `git diff --name-only -z base...head --`. It compares the **filenames changed since the merge-base**, preserving filenames containing spaces via NUL separation. It does not compare patches or simulate a merge.

The JSON report contains the checked-out HEAD, each head's resolved commit SHA, exact base/head refs, sorted changed files, pairwise overlaps, number of clear pairs, and limitations.

- Exit **0**: no same-file overlap among the supplied pairs (`NO_FILE_OVERLAP`).
- Exit **2**: overlapping files need human review (`OVERLAP_REVIEW_REQUIRED`), but this does not prove a Git conflict.
- Exit **1**: invalid arguments, absent refs or Git errors; no valid report is claimed.

Unshared files can still contain incompatible changes; overlapping files can merge without a conflict. Neither status implies tests have passed or gives permission to merge. No production updates, npm release, or GitHub Actions are performed.

## Real example: competing axis tests

PRs #27 and #28 are stacked on PR #22 and both change `tests/pilot-axis-canvas.browser.test.mjs`. Their overlapping filename must be reviewed and the strongest assertions consolidated **once**, rather than integrating both files by default. The audit reports this at the file level without inventing browser PASS results.

PR #22, PR #43 and PR #44 share a different relation: the latter two target #22 and should be reviewed against their actual stacked base and against each other before consolidation. When reports list identical filenames (e.g. `package.json`), inspect and reconcile them manually in a temporary checkout.

## Test and scope

```bash
node --test tests/check-pr-overlap.test.mjs
```

Five tests create **disposable synthetic local Git repositories** and exercise ref validation, independent/overlapping branches, stacked PRs, CLI exit codes and unknown refs. These tests are part of the project's local `preflight`. They do not require GitHub connectivity, WebGL, a real asset pack or test credentials.

Do not treat this as a substitute for `npm run verify:angular`, Chromium/Firefox interactions, real-artwork parity or Astrolabio/headless checks. Consult `docs/LOCAL_QA_REPORT.md` for the complete Windows gate.
