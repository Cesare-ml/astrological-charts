# Chromium vs Firefox — WebGL buffer report comparison

This is a **stacked draft improvement** to the offline report analyzer in
[PR #67](https://github.com/Cesare-ml/astrological-charts/pull/67), which
depends on the browser buffer probe in
[PR #65](https://github.com/Cesare-ml/astrological-charts/pull/65).
It does not modify the production chart renderer, Three.js service, or UI.

## Running the diagnostic locally

Use a checkout containing #65, #67 and this branch. With Node, an installed
Playwright-compatible Chromium and Firefox, and the synthetic test pack:

```sh
npm ci
npm run demo:pack
npm run demo:assets
```

Leave the asset server running and start `npm run demo` in a second terminal.
In the third terminal, run two identical workloads:

```powershell
$env:CHART_BUFFER_REDRAWS = '100'
$env:CHART_BUFFER_EXPORTS = '5'
$env:CHART_TEST_BROWSER = 'chromium'
node scripts/benchmark-webgl-buffers.mjs > .local/webgl-chromium.json
$env:CHART_TEST_BROWSER = 'firefox'
node scripts/benchmark-webgl-buffers.mjs > .local/webgl-firefox.json
node scripts/compare-webgl-buffer-reports-cli.mjs .local/webgl-chromium.json .local/webgl-firefox.json
```

## Benchmark provenance and exact-match checks

The browser benchmark now includes three additional local-only metadata values:

- `sourceRevision`: the 40-character Git HEAD commit when `git` is available.
- `sourceDirty`: whether **tracked files** have local modifications; `null`
  means Git status was unavailable (not that the checkout was clean).
- `assetManifestSha256`: SHA-256 of the local synthetic pack manifest's
  **actual bytes**, defaulting to
  `.local/demo-pack/manifests/approved-assets.json`. The digest is `null`
  if the default manifest does not exist. A custom manifest path is accepted
  via `CHART_BUFFER_ASSET_MANIFEST`; an explicitly specified missing, empty
  or oversized manifest fails the benchmark.

The analyzer rejects malformed SHA values. When both reports provide a
source revision, **different commits are rejected**. When both provide a
manifest digest, **different manifests are rejected**. Missing metadata
produces a warning instead of a false guarantee of comparability; a dirty
working tree or unavailable Git status also produces a warning. The
comparison JSON retains the provenance for both browsers.

The manifest digest identifies the metadata file, **not the actual image
bytes served or loaded by the browser**. Git HEAD alone cannot identify
untracked files or guarantee that the Angular development server is running
a build from that revision. The manifest-verified asset server and a clean,
controlled environment are still mandatory. The report records no local
filesystem paths, credentials, image contents or diffs.

Run the provenance unit suite independently:

```sh
node --test tests/webgl-benchmark-provenance.test.mjs
```

The CLI accepts two JSON paths in **either order**, reads at most 5 MB from
each, performs no network requests or file modifications, and writes a single
JSON summary to standard output. It exits with code 2 for wrong CLI usage and
code 1 for unreadable, corrupt or noncomparable reports.

Run standalone regression tests without Angular, a GPU or the local servers:

```sh
node --test tests/compare-webgl-buffer-reports.test.mjs tests/compare-webgl-buffer-reports-cli.test.mjs tests/webgl-benchmark-provenance.test.mjs
```

## Repeatability across independent runs (same browser)

One browser benchmark measures one workload, not stability over time. The
optional `summarize-webgl-repeatability-cli.mjs` reads **2 to 20** saved runs
of the **same browser and version**, matching natal chart, viewport and
redraw/export counts. It reuses the #67 strict per-context accounting checks.
When both reports provide Git revision or manifest SHA-256, mismatches are
rejected; unknown provenance, modified tracked source or mixed runtime
metadata become warnings, never silent assertions of identical conditions.

For example, after starting the same local synthetic demo and asset servers
described above, run three independent 100-redraw / 5-PNG workloads in
PowerShell:

```powershell
$env:CHART_BUFFER_REDRAWS = '100'
$env:CHART_BUFFER_EXPORTS = '5'
$env:CHART_TEST_BROWSER = 'chromium'
1..3 | ForEach-Object { node scripts/benchmark-webgl-buffers.mjs > ".local/webgl-chromium-run$_.json" }
node scripts/summarize-webgl-repeatability-cli.mjs .local/webgl-chromium-run1.json .local/webgl-chromium-run2.json .local/webgl-chromium-run3.json
```

Repeat separately with `CHART_TEST_BROWSER=firefox` and Firefox-specific file
names. Do not mix browser runs in the same repeatability summary. The
read-only CLI accepts 2–20 paths, each at most 5 MB, and outputs JSON:

- `persistentRedrawLiveDelta`: difference of explicitly API-live buffers
  in pre-existing contexts between initial and final redraw snapshots.
- `exportContextLive`: explicitly API-live handles in contexts first
  observed during PNG exports.
- `newExportContexts`: number of newly observed contexts during exports.
- `finalLive`: total API-live handles at the end of the full workload.

Each metric reports `min`, `max`, `span = max − min`, and `values`
in command-line file order. **The span is variation across runs, not a memory
allocation, trend, leak verdict or a pass/fail threshold.** Resource cleanup by
WebGL context destruction may not emit a matching `deleteBuffer` call.

The separate unit and CLI tests use synthetic reports only:

```sh
node --test tests/summarize-webgl-repeatability.test.mjs tests/summarize-webgl-repeatability-cli.test.mjs
```

Compare the observed ranges within each browser before looking at the
Chromium/Firefox descriptive differences. Run actual browser tests and
platform GPU memory profiling before proposing a resource cleanup fix.

## Comparison rules

The tool first uses the #67 analyzer to validate every snapshot, context
counter, and checkpoint. It then requires one `chromium` report and one
`firefox` report with identical chart type, viewport dimensions, redraw
count and PNG export count. It refuses to compare different workloads.
Each input must identify a non-empty browser version. Where both reports
contain valid ISO-8601 UTC `recordedAt` timestamps, the tool warns when
they were collected more than 24 hours apart; missing or malformed timestamps
also produce an explicit warning. The output includes each browser's reported
version and UTC session timestamp (or `null` when missing). Neither proximity
nor a matching browser version proves identical binaries, source commits
or asset packs.
The summary always uses the same browser order and includes:

- Per-browser initial, after-redraw and final API-live buffer counts.
- The number of API buffer creations/deletions and net-live deltas during
  redraws versus exports.
- Positive API-live delta in persistent contexts, and the counts attributed
  to additional contexts first seen during exports.
- `firefoxMinusChromium` signed differences and explicit warnings for
  mismatched Node/platform/architecture metadata, resource growth and
  context-loss events.

**Limitations:** Both probes use a locally fixed natal chart and alternating
dark/light skins. Git and manifest fingerprints strengthen report comparison
but do not attest actual Angular bundles, loaded asset bytes, graphics driver
or hardware. Even reports with matching viewport, counts and provenance
cannot prove identical physical test conditions. WebGL buffer handles count explicit
`createBuffer` and `deleteBuffer` API calls, not physical GPU memory
or bytes, allocation sizes, context GC or a proven resource leak.

No performance ranking, leak verdict or automatic threshold is emitted.
Inspect repeatability across multiple runs and corroborate with platform
GPU memory profiling. Chromium/Firefox on a PC cannot certify the deployed
Astrolabio headless renderer or e-ink output. Keep PRs in Draft until the
repo-specific Angular builds, browser checks and owner review are complete.

The comparison is entirely local: no GitHub Actions, publication, changes
to VirgoStars production, AWS, private images, licenses or devices.
