# Reviewing WebGL buffer benchmark reports

This analysis tool is stacked on [WebGL buffer probe PR #65](https://github.com/Cesare-ml/astrological-charts/pull/65). It consumes the probe's JSON checkpoints and separates redraw activity in persistent contexts from new offscreen contexts created during PNG exports. The analysis is **read-only** and offline; no browser, GPU, approved artwork, service, or cloud access is required for the analyzer itself.

## Local workflow

On an approved local checkout of PR #65 plus this stacked PR, install dependencies and start the synthetic Angular demo and asset server as documented in `docs/WEBGL_BUFFER_LIFECYCLE_PROBE.md`. Then save the browser probe's JSON in the git-ignored `.local/` directory.

```powershell
node scripts/benchmark-webgl-buffers.mjs > .local/webgl-buffer-chromium.json
node scripts/summarize-webgl-buffer-report.mjs .local/webgl-buffer-chromium.json
```

Set `CHART_TEST_BROWSER=firefox` before a separate Firefox run, and compare reports only when viewport, browser, skins, redraw/export counts, package version, and asset pack are known. For unit tests, no dev server is needed:

```sh
node --test tests/analyze-webgl-buffer-report.test.mjs tests/summarize-webgl-buffer-report.test.mjs
```

## Output contract

The analyzer verifies non-negative safe integer handle counters, total/per-context consistency, unique context IDs, nondecreasing creation/deletion counters, recorded checkpoint order, and declared totals. Malformed reports fail closed; valid reports print a single JSON summary. The CLI accepts one path and reads at most 5 MB; it does not rewrite the input, output screenshots, or contact any services.

- `phases.redraw` compares the initial checkpoint with the final recorded redraw checkpoint.
- `phases.exports` compares the last redraw checkpoint with final telemetry, including any final asynchronous deletion observations.
- `persistentDuringRedraw` identifies original contexts still seen during the last redraw and their explicit live-handle delta.
- `exportsByContext.newContextIds` identifies contexts first observed after redraws. `newContextLive` separates the API-live handles of those contexts from `existingContextLiveDelta`.
- `notices` highlights positive handle growth and context-loss events **for investigation**, never labels them as leaks.

The analyzer does not enforce a maximum live-buffer growth threshold and intentionally does not fail solely because a count rises. `createBuffer - deleteBuffer` counts describe API operations; actual GPU byte allocation, context garbage collection, memory pressure, driver behavior and e-ink compatibility are not measured. Offscreen WebGL contexts may be released without an explicit `deleteBuffer` for every handle. Do not infer absence or presence of GPU memory leaks from this report alone.

## Merge and validation gate

Merge or review PR #65 first: this branch is based on its head and does not independently change the production renderer or WebGL instrumentation. Run both Node test suites on a clean checkout, then run the browser probe with Chromium and Firefox locally (50–100 redraws and multiple exports). Verify the observed per-context behavior against independent GPU profiling before proposing renderer resource-lifecycle changes. No GitHub Actions, production deployment, npm release, license changes, proprietary asset distribution or Astrolabio firmware changes.
