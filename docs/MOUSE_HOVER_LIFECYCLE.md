# Canvas hover lifecycle regression

The legacy `GestoreEventiMouse` helper owns mouse listeners on a chart canvas
and a resize listener on `window`. It now clears the active hovered object
when the mouse leaves the canvas, when the browser window loses focus, and on
`distruggi()`. Each transition emits `onHoverLeave` **at most once**, even
if a callback synchronously triggers another leave event. Removing a chart
must not leave active listeners or stale highlights attached to old canvases.

## Local deterministic test

After `npm ci` from a clean checkout:

```bash
node --test tests/mouse-hover-lifecycle.test.mjs
```

The test compiles the actual TypeScript helper in memory with the repository's
TypeScript dependency and supplies fake event targets and a small Three.js
raycaster stub. It uses no private birth data, artwork, WebGL or network calls.

Coverage: ten deterministic cases covering canvas leave and re-entry, window
blur, teardown listener removal, callback reentrancy on both enter and leave,
ordinary glyph-to-glyph transition ordering, and preservation of the newest
nested pointer event. A monotonically increasing hover-transition counter
prevents stale outer callbacks from resurrecting a highlight after a leave or
destroy event. The existing click and hit-testing
contract is intentionally unchanged.

## Scope and remaining gates

This is a lifecycle regression for the legacy helper, not a browser-proof of
picking, chart geometry, or the newer interactive glyph renderer proposed in
PR #22. In particular, a real browser acceptance pass should still verify
canvas hover/focus and no unexpected camera zoom in Chromium and Firefox.
This PR is stacked on PR #42 (`fix/mouse-pointer-resize-lifecycle-20261112`),
preserving its `mousePositionToNdc` calculations and last-client-point logic.
The integrated helper clears the stored pointer on blur as well as mouseleave,
so a subsequent resize cannot resurrect stale focus. The new tests cover
AS/DS/MC/IC **event propagation and unchanged camera zoom only**; visual
focus and raycaster geometry still need real Chromium/Firefox review.

No production consumers, visual assets, Angular framework integration,
deployment, or Astrolabio firmware are modified. Before integration, run
`npm run verify:angular` in a complete checkout and record browser evidence
as required by `CONTRIBUTING.md`.

## Regression proof (2026-11-14)

Two newly added tests initially **failed** on the first PR #94 implementation:
mouseleave inside `onHoverEnter` failed to trigger a matching leave, and
mouseleave inside `onHoverLeave` duplicated the leave and entered an obsolete
new glyph. Moving the internal hover-state mutation before consumer callbacks,
and invalidating stale nested transitions, made both tests pass.

The **exact committed file bytes** of the helper and test were reproduced in a
local Node 22.16.0 workspace (matching their Git blob SHAs). Executed:

```bash
NODE_PATH=$(npm root -g) node --test tests/mouse-hover-lifecycle.test.mjs
```

Result: **8 passing, 0 failing**. TypeScript was resolved from the locally
installed global toolchain for this isolated run; the repo's normal `npm ci`
workflow, full Angular preflight/build and Chromium/Firefox WebGL acceptance
were **not run**. Passing mocks must not be interpreted as render parity.

## Stacked integration gate (2026-11-14)

Merged the still-draft PR #42 branch as a Git parent while preserving all
its coordinate-resize test and documentation. This PR now targets the #42
feature branch rather than main; **merge #42 into main first**, then
review/rebase #94. Neither PR has been independently merged or deployed.

The locally reproduced combined TypeScript helper passed:
`NODE_PATH=$(npm root -g) node --test tests/mouse-hover-lifecycle.test.mjs tests/mouse-pointer-lifecycle.test.mjs`
using Node 22.16.0 and TypeScript 5.8.3: **14/14 passed** (10 lifecycle +
4 pointer/resize tests). The local reproduction is not a full repository
checkout; Angular builds, actual WebGL rendering, full consumer tests and
visual screenshots are still **NOT RUN**.
