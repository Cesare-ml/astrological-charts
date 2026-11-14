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

Coverage: fourteen deterministic cases covering canvas leave and re-entry, window
blur, teardown listener removal, callback reentrancy on both enter and leave,
ordinary glyph-to-glyph transition ordering, and preservation of the newest
nested pointer event, concurrent chart instances sharing a window,
invalid canvas geometry, and reentrant teardown during hover callbacks.
A monotonically increasing hover-transition counter
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

PR #94 is based directly on the still-draft PR #42 head, preserving its
coordinate-resize tests and documentation without importing unrelated commits
from main. This is a clean stacked PR: **merge #42 into main first**, then
review/rebase #94. Neither PR has been independently merged or deployed.

The locally reproduced combined TypeScript helper passed:
`NODE_PATH=$(npm root -g) node --test tests/mouse-hover-lifecycle.test.mjs tests/mouse-pointer-lifecycle.test.mjs`
using Node 22.16.0 and TypeScript 5.8.3: **14/14 passed** (10 lifecycle +
4 pointer/resize tests) at the first stacked integration checkpoint. The local reproduction is not a full repository
checkout; Angular builds, actual WebGL rendering, full consumer tests and
visual screenshots are still **NOT RUN**.

## Additional lifecycle regression gate (2026-11-14)

Four independent deterministic scenarios were added after the original
stacked integration:

1. Two chart instances sharing a single window keep independent hover state,
   and destroying one does not remove the other's resize or blur listeners.
2. A zero-width canvas clears a previous highlight, suppresses click picking,
   and can resume valid hover when the canvas becomes measurable again.
3. Destruction triggered by `onHoverEnter` emits a single balancing leave,
   unregisters handlers, and does not receive later movement.
4. Destruction triggered by `onHoverLeave` suppresses entry into the now
   obsolete next glyph.

Locally executed (Node 22.16.0, TypeScript 5.8.3):

```bash
NODE_PATH=$(npm root -g) node --test tests/mouse-hover-lifecycle.test.mjs tests/mouse-pointer-lifecycle.test.mjs
```

**PASS: 18 / 18** (14 hover lifecycle + four inherited pointer/resize).
The committed updated hover test is byte-identical to the locally executed
test file (Git blob SHA `6cd2af0bc4683a247d97899fb2947757c81b75f0`).
The source helper used for the local run reproduces the same logic but is not
claimed to be byte-identical to the branch's TypeScript source. This does
**not** establish `npm ci`, Angular builds, WebGL picking, cross-browser
rendering, or device/e-ink acceptance.

An exploratory headless Chromium DOM harness was attempted locally but its
browser process timed out in this environment; no browser acceptance PASS is
claimed and the unverified harness was not committed to the repository.
