# WebGL buffer lifecycle probe — redraws and PNG exports

This is a manual **diagnostic**, not a GPU memory profiler, production test, or proof that a chart renderer is leak-free. It complements the existing texture-call benchmark: WebGL buffer handles are used to upload geometry (vertices/indices), whereas texture handles describe image resources.

## Run against the synthetic demo

From a clean `astrological-charts` checkout with Node/npm and a local Chromium or Playwright-compatible Firefox:

```sh
npm ci
npm run demo:pack
npm run demo:assets
```

In another terminal:

```sh
npm run demo
```

When both local servers are ready, in a third terminal:

```sh
node --test tests/webgl-buffer-ledger.test.mjs
node scripts/benchmark-webgl-buffers.mjs
```

The CLI runs **30 dark/light redraws and 3 PNG downloads** by default. It reports a JSON summary with environment, checkpoints, per-WebGL-context buffer accounting, and browser or HTTP errors. For 100 redraws and 5 exports on PowerShell:

```powershell
$env:CHART_BUFFER_REDRAWS = '100'
$env:CHART_BUFFER_EXPORTS = '5'
node scripts/benchmark-webgl-buffers.mjs
```

The supported bounds are 1–200 redraws and 1–10 PNG exports. Use `CHART_TEST_BROWSER=firefox` or the `CHROME_PATH` / `FIREFOX_PATH` executable variables from the standard browser test instructions. No GitHub Actions, AWS access, real birth charts or production assets are needed; use the synthetic local pack. Do not run against the live website.

## What is recorded

The probe injects `installWebGLBufferLedger` **before Three.js loads** and observes `createBuffer` and `deleteBuffer` calls on WebGL1 and WebGL2 prototypes. It uses weak references to context and buffer identities; it retains only numeric per-context counters. Null handles, duplicate delete calls, inherited WebGL2 implementations, and failed native deletions are handled without double counting.

At the initial render, every 10th redraw, the last redraw and after each downloaded PNG, the output reports:

- `created`: non-null WebGLBuffer handles observed.
- `deleted`: previously observed handles explicitly deleted by their originating context.
- `live`: observed creations minus explicit deletions (not GPU bytes).
- `contexts`: different contexts that created a tracked buffer.
- `contextLost`: observed `webglcontextlost` events.

Every export creates an offscreen renderer with its own WebGL context, so counts may differ from a simple redraw-only baseline. Even after `WebGLRenderer.dispose()`, a context can be garbage-collected later without an explicit `deleteBuffer` call for every handle. **A growing `live` count is a signal to investigate, not proof of a GPU memory leak.** The instrumentation does not retain GPU handles strongly, calculate GPU memory bytes, force garbage collection, or enforce arbitrary growth thresholds.

The probe fails for broken rendering, missing/empty PNGs, browser/HTTP errors, absent observed buffer creation/deletion, or a context-loss event. It does **not** fail merely because the cumulative live-handle count grows.

## Required signoff

Before merging any lifecycle-related fix, run `npm run verify:angular`, the full Chromium and Firefox rendering suites, and this probe against 50–100 redraws with the synthetic pack. Record Node/browser versions, asset source, commit SHA and environment, compare multiple runs and inspect actual GPU memory by platform-specific profiling where possible. Test real artwork and Astrolabio/headless consumers separately; neither the synthetic probe nor this document certifies visual parity, GPU memory stability or hardware support.
