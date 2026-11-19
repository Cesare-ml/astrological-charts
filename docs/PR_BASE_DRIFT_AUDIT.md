# Offline PR base-drift audit

When several draft PRs are developed in parallel, a base branch can advance **after** a feature branch was created. `scripts/check-pr-overlap.mjs` detects common filenames *between two PR heads*; it does not flag files independently modified on the new base. This small, separate check looks for the latter risk.

```powershell
node scripts/check-pr-base-drift.mjs main:fix/branch-a main:feat/branch-b
# For a stacked PR, use its actual parent branch, not main:
node scripts/check-pr-base-drift.mjs feat/interactions:test/axis-child
node --test tests/check-pr-base-drift.test.mjs
```

Run from a checkout where the desired base and head refs **already exist locally** (fetch them separately if needed). The script does not fetch, check out, create files, merge, publish or contact GitHub. It accepts one or more `base:head` pairs and produces JSON on standard output, with exact `baseRevision`, `headRevision` and `mergeBase` commit SHAs. Compare these SHAs with the actual GitHub PR tips at review time.

For each pair it compares the changed file paths from the historical merge-base to the current base tip and to the head tip, using NUL-safe `git diff --no-renames --name-only -z`. A path present on **both** sides is reported under `overlappingFiles`; `baseAdvanced: true` alone can also indicate the PR is behind but does not by itself mean a same-file collision. Rename detection is disabled to expose added and deleted paths rather than silently coalescing them.

- Exit **0 / `NO_BASE_DRIFT_OVERLAP`**: no same-filename edits against the moving base were found.
- Exit **2 / `BASE_DRIFT_REVIEW_REQUIRED`**: one or more same-filename changes should be reviewed and the branch refreshed before validation.
- Exit **1**: invalid arguments, missing refs, or a Git failure; no successful report is claimed.

This audit is **not** a merge simulation or correctness test. It can report a harmless overlap; conversely different file paths may conflict semantically, and a rename/path overlap may require manual inspection. The tool cannot discover missing remote changes, test Angular/WebGL output, verify artwork licenses or give permission to merge. Run the existing `check-pr-overlap.mjs` as well when comparing separate PR heads, then complete the local `npm run verify:angular`, Chromium/Firefox PNG and Astrolabio acceptance gates as applicable.

The regression suite creates temporary synthetic Git histories, including a base advancing on the same path, an unrelated base advance, and a stacked child whose parent moves. No production data, chart graphics, assets, GitHub Actions or deployments are involved.
