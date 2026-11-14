# Keyboard acceptance: four natal axes in the interactive demo

This is an **optional Playwright browser acceptance test**, stacked on
draft interaction PR #22. It does not change renderer code or assets. Its
goal is to catch a regression where a keyboard user cannot focus an axis
using the Angular demo's native buttons, or a keyboard selection changes
the canvas camera/zoom.

## Test contract

`tests/axis-keyboard-focus.browser.test.mjs` runs the **real** Angular
demo in **transits mode** with the synthetic `demo/interaction-fixtures.ts`
relationships:

| Natal axis | Illustrative transit partner | Key |
| --- | --- | --- |
| AS | Neptune | Enter |
| DS | Mars | Space |
| MC | Neptune | Enter |
| IC | Mercury | Space |

After increasing zoom to a **non-default** value, the test focuses the
first AS button and then uses **real Tab navigation** through DS, MC and IC,
alternating Enter and Space activation (never `button.click()` for axis
selection). It asserts the selection label, exactly one illustrative
aspect, the partner name, `aria-pressed`, correct tab order and retention
of keyboard focus. It checks unchanged **live Angular development
camera UUID, scene UUID, zoom, position, quaternion, 16-value
projection matrix, canvas dimensions, drawing-buffer dimensions and
render revision** after each focus and after keyboard Clear selection.

Missing WebGL, browser, Angular development debug service, camera or
scene metadata **fails** the test rather than silently weakening
its no-zoom assertion.

The test also switches the layer selector **using ArrowDown/ArrowUp**,
selects `transit:AS` with Space and verifies it has **no** relationship
borrowed from `natal:AS`. Switching back to the natal layer and pressing
Enter must restore the one supplied illustrative relationship. Camera
invariants remain enforced across these layer switches.

A source-level V8 syntax parse and inspection of actual demo bindings and
fixtures succeeded for this extension; these checks do not establish
that the Angular application or either browser has passed.

## Fast regression without browser or WebGL

`tests/axis-keyboard-contract.test.mjs` reads the **real**
`demo/main.ts` using the project's TypeScript dev dependency. It checks
that the Angular template still offers native buttons with live ARIA state,
a keyboard-operable layer selector, four ordered house axes and a Clear
control. It then executes the actual TypeScript bodies of
`changePlanetLayer`, `selectPlanet` and `clearPlanet` in a small
in-memory probe, covering natal/transit identities, null clearing,
busy-state selection blocking and absence of zoom calls.

```sh
npm ci
node --test tests/axis-keyboard-contract.test.mjs
```

This test is standalone and **not yet added to the preflight script**
because several draft branches already edit `package.json`.
It deliberately avoids duplicating the existing
`tests/demo-axis-fixture-contract.test.mjs` fixture/aspect calculations.
The browser-based `tests/axis-keyboard-focus.browser.test.mjs` below
remains mandatory to verify native Tab/Enter/Space behavior, live WebGL
camera and actual Angular rendering.

At the GitHub-connector review stage, isolated V8 execution of the actual
demo `selectPlanet` / `changePlanetLayer` / `clearPlanet` method bodies
succeeded: natal AS/DS/MC/IC, switching AS to transit and back, clear,
and busy-blocked selection all behaved as expected; there were **zero**
zoom calls. This is **not** a complete `node --test` run against
the full repository or a browser result.

## Local run (no Actions)

Install dependencies from the checked-out PR #22 + this stacked branch:

```sh
npm ci
npm run demo:generate-synthetic
```

Start the manifest-validated asset server in one terminal:

```sh
npm run demo:preview
```

Start the Angular development server in a second terminal:

```sh
npm run demo
```

Run the new **opt-in** regression in a third terminal:

```sh
CHART_TEST_BROWSER=chromium node --test tests/axis-keyboard-focus.browser.test.mjs
CHART_TEST_BROWSER=firefox node --test tests/axis-keyboard-focus.browser.test.mjs
```

On Windows PowerShell, set the variable as
`$env:CHART_TEST_BROWSER='chromium'`, then run `node --test ...`.
Override `CHROME_PATH` or `FIREFOX_PATH` for an installed browser
not on the defaults list.

This test uses `127.0.0.1:4200` for the Angular demo and
`127.0.0.1:4177` for synthetic local assets. It needs Chromium/Firefox
with functional WebGL. The Angular **development** build is intentional
because it must expose `ng.getComponent`; this is not a public runtime
API and no production build is asserted.

## Limitations and merge gates

- It tests keyboard button input, **not** screen-reader compatibility,
  native canvas raycasting or the actual pixel differences.
- PR #54 separately handles pixel-level canvas and real pointer picking
  checks for AS/DS/MC/IC, avoiding duplicate coverage and file overlap.
- No astronomical calculation, original imagery, real birth data,
  PNG/headless export or Astrolabio hardware verification is performed.
- Syntax/read-back checks alone are **not** a successful browser run.
  Run both browsers on a complete checkout and retain logs before review.
- Do not deploy, publish, merge or enable GitHub Actions from this test PR.
