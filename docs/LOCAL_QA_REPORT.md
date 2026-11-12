# Repeatable Windows verification and QA evidence

The repository includes `scripts/verify-local.ps1` for contributors and Codex
running on Windows. It runs **only** the local dependency and Angular gates; it
does not merge branches, deploy VirgoStars/Astrolabio, execute GitHub Actions,
publish npm packages, or contact a production backend.

## Normal use

From a clean checkout of the branch/PR under test:

```powershell
powershell -NoProfile -File .\scripts\verify-local.ps1
```

The runner requires a committed `package-lock.json`; if absent it **fails**
rather than running `npm install` and implicitly resolving a different tree.
It executes exactly:

1. `npm ci` — clean, lockfile-based installation.
2. `npm run verify:angular` — repository canonical gate: preflight,
   `build:library`, then `build:demo`.

Each command stops the runner when its native exit code is nonzero. Re-running
against an existing and already installed checkout is possible with
`-SkipInstall`; the report makes the skipped dependency step visible. Do not
use `-SkipInstall` as evidence of a reproducible *clean* checkout.

## Report format

The ignored file `.local/verify-local-report.json` is written on both success
and handled failure (provided the local filesystem permits writing there).
It records:

- `revision`: the tested Git HEAD when Git is available.
- `nodeVersion`, `npmVersion`: versions printed by local executables.
- `steps`: each actual command with `PASS`, `FAIL`, `NOT RUN` or
  `SKIPPED` status, and an integer exit code for executed npm steps.
- `status`: `PASS` only if all required executed steps succeed (or if the
  install is explicitly skipped and the Angular gate succeeds).
- `failure`: a short failure message when a step fails.
- `browserChecks`, `originalArtworkParity`, `astrolabioIntegration`:
  deliberately `NOT RUN`. A successful Node or Angular build cannot
  establish those outcomes.

The report does not include package installation logs, birth data, token values,
environment variables, absolute working directories or external credentials.
The console still shows npm output; check it before sharing diagnostics.

## Extra validation for interactive PRs

The runner is a **preflight gate**, not a browser automation launcher. For
a stacked PR such as interaction PR #22, do the separate local checks from the
target PR's instructions, and report the outcomes *separately*:

```powershell
npm run demo:pack
# Terminal A:
npm run demo:assets
# Terminal B:
npm run demo
# Terminal C (with the servers ready):
npm run test:demo
npm run test:demo-interactions
```

`test:demo-interactions` is available on PR #22, not necessarily on
`main`. Use the published tests and exact commands from the checked-out
branch, and run Chromium/Firefox checks where supported.

Before integrating #22, separately test native natal axes AS/DS/MC/IC, transit
focus both ways, no planet scaling, 50 redraws, line/texture disposal, real
assets with explicit rights, browser PNG, and device-specific headless output.
No PASS is implied for these gates by this script. Do not merge based on the
generated JSON alone.

## Verifying the runner itself

```bash
node --test tests/verify-local-runner.test.mjs
```

This is a **source-contract test**. Running it with Node checks that the
PowerShell script targets the correct canonical gate and produces the intended
report fields. It does **not** execute PowerShell or `npm ci`. Run the actual
`verify-local.ps1` on a Windows checkout before shipping this change.
