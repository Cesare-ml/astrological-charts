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

The tool first resolves **both local refs to immutable commit SHA values**, then determines their historical common ancestor with `git merge-base <baseRevision> <revision>`. Finally it compares only that snapshot using `git diff --name-only -z <mergeBase> <revision> --`. This matches the changed-file semantics of `base...head`, but protects against concurrent base/head ref movement between commands. It preserves filenames containing spaces via NUL separation. It does not compare patches or simulate a merge.

The JSON report contains the checked-out HEAD, the exact `base` and `head` ref names, **`baseRevision`** and **`revision`** commit SHAs, the historical **`mergeBase`** SHA, sorted changed files, pairwise overlaps, number of clear pairs, and limitations. Reviewers should compare these SHAs with the PRs' current GitHub branch tips before using an older report: re-run the audit if either branch has advanced. A change to the base tip can leave the historical merge-base unchanged.

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

Six tests create **disposable synthetic local Git repositories** and exercise ref validation, independent/overlapping branches, stacked PRs, CLI exit codes, unknown refs and advancing base tips. The moving-base test proves the new report distinguishes the current base commit from the older merge-base while preserving the same changed-file audit. These tests are part of the project's local `preflight`. They do not require GitHub connectivity, WebGL, a real asset pack or test credentials.

Do not treat this as a substitute for `npm run verify:angular`, Chromium/Firefox interactions, real-artwork parity or Astrolabio/headless checks. Consult `docs/LOCAL_QA_REPORT.md` for the complete Windows gate.
