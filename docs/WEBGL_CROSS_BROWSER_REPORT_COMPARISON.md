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

The CLI accepts two JSON paths in **either order**, reads at most 5 MB from
each, performs no network requests or file modifications, and writes a single
JSON summary to standard output. It exits with code 2 for wrong CLI usage and
code 1 for unreadable, corrupt or noncomparable reports.

Run standalone regression tests without Angular, a GPU or the local servers:

```sh
node --test tests/compare-webgl-buffer-reports.test.mjs tests/compare-webgl-buffer-reports-cli.test.mjs
```

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
dark/light skins, but saved reports do not carry cryptographic fingerprints
of the code revision, synthetic asset pack or graphics driver. Even reports
with matching viewport and counts are not sufficient to establish identical
hardware, fixtures or asset provenance. WebGL buffer handles count explicit
`createBuffer` and `deleteBuffer` API calls, not physical GPU memory
or bytes, allocation sizes, context GC or a proven resource leak.

No performance ranking, leak verdict or automatic threshold is emitted.
Inspect repeatability across multiple runs and corroborate with platform
GPU memory profiling. Chromium/Firefox on a PC cannot certify the deployed
Astrolabio headless renderer or e-ink output. Keep PRs in Draft until the
repo-specific Angular builds, browser checks and owner review are complete.

The comparison is entirely local: no GitHub Actions, publication, changes
to VirgoStars production, AWS, private images, licenses or devices.
