# Browser acceptance for scene animation and WebGL resource lifecycle

This optional Playwright gate is a **child of draft PR #57**. It provides browser-level coverage for the exception-safe scene teardown and offscreen PNG export in `GraficoRenderService`, without changing renderer code, the chart public API, astrology calculations, geometry or real image assets. Its test files were adapted from draft PR #60 to avoid a conflicting second implementation of scene animation cleanup.

## Requirements

Use a clean local checkout of this branch (based on PR #57), a supported Node version, an installed Chromium or Firefox binary, and the repository-generated synthetic chart pack. From the repository root:

```sh
npm ci
npm run verify:angular
npm run demo:pack
```

Leave the following in separate terminals:

```sh
npm run demo:assets
npm run demo
```

Then in a third terminal:

```sh
npm run test:demo-webgl-lifecycle
```

The Angular **development** server is required so `ng.getComponent` can find the actual chart component and its service. This test does not work against a production-minified app. Default browser is Chromium; set `CHART_TEST_BROWSER=firefox` with `FIREFOX_PATH` if needed to repeat in Firefox. Use `CHROME_PATH` for a nonstandard Chrome executable.

## What the test checks

- Four natal warmups, then **50** natal redraws alternating the light/dark skins. Compare the same natal/light skin before and after via `renderer.info.memory` (tracked geometries and textures).
- **20** PNG exports across natal, transits, synastry and latitude modes, validating PNG dimensions (1600×1600) and preserving the active renderer, scene, camera and resource counters.
- Decode the first exported PNG of each mode with `sharp`, validate decoded pixel dimensions and count visible RGB colors after flattening alpha. Reject blank/uniform images, including fully transparent images with hidden RGB data. This is a synthetic **visibility smoke test**, not visual-baseline parity.
- Measure WebGL1/WebGL2 `createTexture`/`deleteTexture` *call deltas* across each temporary offscreen PNG context, distinct from the primary renderer accounting.
- Create a temporary second canvas and `GraficoRenderService`, render it, redraw the first, and check that the second's resource counters remain unchanged; release the temporary chart afterward.
- Fail on page errors, failed HTTP responses, WebGL context losses and missing resource instrumentation. Export checkpoints are printed as JSON to the terminal, not submitted to a server.

Counts and optional growth thresholds are controlled with environment variables. Example for PowerShell:

```powershell
$env:CHART_LIFECYCLE_REDRAWS = '100'
$env:CHART_LIFECYCLE_EXPORTS = '50'
$env:CHART_LIFECYCLE_MAX_TEXTURE_GROWTH = '0'
$env:CHART_LIFECYCLE_MAX_GEOMETRY_GROWTH = '0'
$env:CHART_LIFECYCLE_MAX_EXPORT_HANDLE_GROWTH = '0'
npm run test:demo-webgl-lifecycle
```

Cycle counts accept 1–100. Growth thresholds are optional (default: just report deltas); zero may be overly strict on some browser/driver combinations and must be calibrated against real results. `CHART_TEST_BROWSER`, `CHROME_PATH` and `FIREFOX_PATH` follow the existing demo browser convention.

Run `npm run test:webgl-lifecycle-instrumentation` and `npm run test:synthetic-png` for the fast Node regressions. The latter uses generated in-memory colorful, white, transparent and invalid PNG fixtures; no original artwork is required.

Run `npm run test:webgl-lifecycle-instrumentation` for the WebGL counter unit test. It extracts the **same** browser-side WebGL counter callback from source and exercises six cases: native WebGL1, WebGL2 inheritance, WebGL2 overrides, context-loss notification, WebGL1/WebGL2 inheriting a **shared WebGL base prototype**, and subclass methods that call `super`. The instrumentation climbs the prototype chain to find the method owner, patches shared owners only once and avoids duplicate counts from nested overrides. This fast test is included in `preflight`. The full browser test is deliberately **not** included because it requires an actual local browser, both dev servers and WebGL.

## Interpretation and limits

Three.js `renderer.info.memory` is **not physical GPU memory**. WebGL texture API *call balances* are **not a live-handle count**, and a stable count does not prove absence of leaks. Synthetic checkerboards are **not licensed production artwork** or an approved visual baseline. Non-uniform sampled colors do **not** establish correct symbols, visual positioning or astronomical calculations. A successful browser run is not an Astrolabio/e-ink compatibility sign-off; separate original-artwork, mobile PNG and device testing remains required.

The inherited PR #57 lifecycle helpers preserve original cleanup exceptions and may aggregate failures in `AggregateError`. This suite does not override that behavior with the warning-only policy proposed separately by PR #60. Do not merge both competing cleanup implementations blindly. No GitHub Actions, npm publication, production deployment or automatic merge is part of this gate.

## Verification record

Source copied from PR #60 browser harness at blob `2238d9bb8396f125a50c6b97caab8172023e220f` and synthetic instrumentation test at `dbc586826ba75b7ce6e835a8dcd27a2823b1dcc3`. Source parse/readback alone is **not** successful browser execution. On the authored branch, record commit SHA, browser version, Node version, commands, exit codes and actual output before changing Draft status.
