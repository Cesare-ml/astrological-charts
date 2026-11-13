# AS/DS/MC/IC – browser canvas acceptance gate

This is an **opt-in**, read-only local development test for the pending
interactive planets/transits feature (draft PR #22). It reconciles overlapping
wave-2 axis tests proposed in PRs #27 and #28 without copying third-party
artwork or modifying the production VirgoStars/Astrolabio application.

## What is verified

`tests/axis-focus-canvas.browser.test.mjs` exercises the running Angular
`demo/` application with synthetic horoscope/aspect fixture inputs.

- The chart uses a real, visible WebGL canvas with nonzero drawing-buffer
  dimensions; the screenshot includes only the chart canvas, not sidebar UI.
- Switching the sidebar planet layer without selecting a body is a **negative
  control**: it must not change the canvas pixels.
- Selecting natal **AS, DS, MC, IC** individually must change on-canvas pixels,
  including the central aspect area, and provide the expected fixture
  transit partner (AS/MC→Neptune, DS→Mars, IC→Mercury).
- Applying the hard-only aspect filter must remove the selected axis's
  supplied semisquare and visibly change the central aspect area;
  restoring the filter must restore the original focus pixels.
- Clearing each axis selection must restore the neutral canvas without
  residual highlighted lines.
- The canvas size, drawing buffer, render-revision counter, **camera
  transform/zoom/projection**, and scene identity must remain unchanged
  during all focus/filter/clear operations.
- Browser exceptions fail the test. Two-frame waits and a measured
  idle-noise comparison guard against accidentally passing a DOM-only
  screenshot.

The **Angular development debug API is required** for the no-zoom check.
The gate checks camera/scene metadata **on every compared screenshot**, not
only the first one. If either snapshot lacks Angular debug metadata, if
the camera zoom is zero/nonfinite, or if its position, quaternion or projection
contains an invalid value, the gate fails rather than silently skipping
the no-zoom check. A production-optimized build that omits
`ng.getComponent` is not a valid environment for this specific test.

## Run locally

From an authorized clone of this repository on Windows or another platform:

```bash
npm ci
npm run demo:generate-synthetic
```

Start the synthetic approved-manifest asset server in one terminal:

```bash
npm run demo:preview
```

Start Angular in another terminal:

```bash
npm run demo
```

Then execute Chromium in a third terminal:

```bash
npm run test:demo-axis-pixels
```

Set `CHROME_PATH` if the browser is not discovered automatically. For
Firefox, set `CHART_TEST_BROWSER=firefox` and, if needed, `FIREFOX_PATH`.
For example, in PowerShell:

```powershell
$env:CHART_TEST_BROWSER = 'firefox'
$env:FIREFOX_PATH = 'C:\Program Files\Mozilla Firefox\firefox.exe'
npm run test:demo-axis-pixels
Remove-Item Env:CHART_TEST_BROWSER
Remove-Item Env:FIREFOX_PATH
```

`npm run test:demo-axis-contract` is the separate, fast source/fixture
validation. `npm run test:demo-axis-invariants` is a separate **fast Node
regression** that executes the browser gate's actual camera/scene comparator
using synthetic snapshots: missing debug data, changed zoom, changed
projection, invalid matrices and scene rebuilds must fail. Both of these
fast tests are registered in `npm run preflight`.

The full browser test is deliberately **not** in `npm run preflight`
because it requires local development servers, browser executables,
GPU/WebGL availability, and visual acceptance.

## Boundaries

A passing synthetic pixel test is **not** proof of original-font or
artwork parity, real astronomical positions, mobile layout, e-ink PNG export,
or VirgoStars/Astrolabio compatibility. Complete the full
`npm run verify:angular` and browser/asset/license checks before merging
PR #22 into `main`. No GitHub Actions, production deploy, license changes,
or redistribution of original assets are part of this gate.

## Real pointer hit-testing

A second, deliberately opt-in browser test now exercises the *actual* AS,
DS, MC and IC glyphs with mouse events on the WebGL canvas:

```bash
npm run test:demo-axis-pointer
```

This command uses the same running Angular development demo, synthetic assets
and optional `CHART_TEST_BROWSER` / browser-path variables as
`test:demo-axis-pixels`. It inspects the live Three.js chart via Angular's
**development-only** debug API, finds each natal axis mesh by its
`userData.chartPlanet` identity, projects its world position through the
actual camera and moves/clicks the browser mouse at that point.

The test verifies real `data-testid=planet-hover`, latched selection and
`click natal:AS/DS/MC/IC` events; clearing hover must not clear the
user-selected axis, and explicitly clearing selection must work. Scene UUID,
camera UUID, zoom, position, quaternion, projection, WebGL drawing buffer,
canvas dimensions and render revision must not change during these actions.
If the camera, mesh, projected position or live WebGL context is unavailable,
the test fails instead of substituting a simulated pointer location.

This is an **additional** acceptance gate, not an assertion that hover and
click already work in Chromium and Firefox. The test is not part of
`preflight` because it requires live local servers and an installed
browser. Run both browser commands separately and collect real results
before requesting merge of the parent draft PR #22 to `main`.

The projected mesh must also be visible on the **currently active camera
layer**, mirroring the raycaster's camera-mask behavior. Otherwise an
out-of-view/hidden-layer duplicate natal axis could produce an artificial
pointer coordinate even when another visible glyph exists.

A new fast regression, `npm run test:demo-axis-projection`, extracts the
**actual browser test's `page.evaluate` callback** (not a duplicate
projection algorithm) and exercises it with synthetic Three.js-like meshes.
Six source-level cases verify canvas CSS coordinates, active camera layers,
hidden ancestors/materials, transparency, out-of-view glyphs and absent
Angular debug metadata. It is registered in `preflight`, but does not
replace the required real Chromium/Firefox pointer test.
