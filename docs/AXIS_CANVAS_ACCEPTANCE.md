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
The test fails closed if it cannot inspect the demo camera/scene. A
production-optimized build that omits `ng.getComponent` is not a valid
environment for this specific acceptance test.

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
validation. This browser test is deliberately **not** in `npm run preflight`
because it requires both local development servers, browser executables,
GPU/WebGL availability, and visual acceptance.

## Boundaries

A passing synthetic pixel test is **not** proof of original-font or
artwork parity, real astronomical positions, mobile layout, e-ink PNG export,
or VirgoStars/Astrolabio compatibility. Complete the full
`npm run verify:angular` and browser/asset/license checks before merging
PR #22 into `main`. No GitHub Actions, production deploy, license changes,
or redistribution of original assets are part of this gate.
