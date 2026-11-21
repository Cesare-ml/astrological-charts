# Offline Chromium/Firefox screenshot matrix audit

This **read-only** Node.js tool checks the screenshot files already produced
by the repository's browser smoke tests. It does not launch a browser, build
Angular, calculate astrology, compare original VirgoStars artwork, or modify
the screenshot directories.

The required matrix is **four demo chart modes** (`natal`, `transits`,
`synastry`, `latitude`) times **seven skins** per browser, yielding
28 captures in Chromium and 28 in Firefox.

## Steps (Windows PowerShell)

In a clean checkout, complete the documented visual QA setup in
[ANGULAR_DEMO.md](ANGULAR_DEMO.md): `npm ci`, `npm run verify:angular`,
`npm run demo:pack`, and start both local asset and Angular demo servers.
Before a new QA pass, archive or clear the previous local screenshot output
folders to avoid reusing old files.

Run the actual browser tests on the same branch/commit:

```powershell
npm run test:demo
$env:CHART_TEST_BROWSER = 'firefox'
npm run test:demo
Remove-Item Env:CHART_TEST_BROWSER -ErrorAction SilentlyContinue
```

After **both** browser runs have passed, execute:

```powershell
node scripts/audit-browser-screenshots.mjs --chromium .local/demo-screenshots --firefox .local/demo-screenshots-firefox
```

The command prints machine-readable JSON, including each file's SHA-256,
byte count, mode, skin and browser, plus the canvas dimensions. Redirect
stdout into an ignored local QA report if needed. It exits **0** when the
filesystem matrix is complete and structurally consistent; **1** when any
required screenshot is absent, duplicated, truncated or corrupt at the PNG
chunk/CRC level, or when dimensions differ within/across browsers. A stale
`repeat-*.png` from an earlier failed redraw comparison also blocks the
audit. Expected `export.png` and `mobile.png` are ignored here because
they have different dimensions and are validated by the browser suite.

The check does **not** decompress/compare visual pixels, distinguish blank
screens from nonblank ones, confirm screenshots came from the current
commit, measure GPU memory, or prove desktop/mobile/e-ink/Astrolabio
compatibility. It also does **not** compare approved original-artwork
reference images. Record the Git SHA, browser versions, asset manifest
fingerprints and successful browser commands separately. Captured images
remain local ignored artifacts; do not commit third-party imagery.

## Focused offline regression

```powershell
node --test tests/audit-browser-screenshots.test.mjs
```

This test uses only Node built-ins to create disposable synthetic PNG files
and checks the CLI, the complete matrix, hashes, bad checksums,
truncation, missing and duplicated captures, stale failure artifacts,
per-browser size discrepancies, and agreement with the demo browser suite's
mode/skin declarations. It does not require WebGL, browser binaries,
Cloudflare/AWS, a local asset server or any real chart data.

This auxiliary audit is deliberately **not** a merge approval by itself.
Run it after real Chromium and Firefox tests as one additional reviewer gate.
No GitHub Actions, production deployments, npm publication or device
updates are introduced.
