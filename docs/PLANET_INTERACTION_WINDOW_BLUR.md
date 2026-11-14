# Interactive chart: window blur and pointer focus lifecycle

## Issue

The pending `PlanetInteractionController` in draft PR #22 listens for
`pointerleave`, `pointercancel`, and canvas clicks, but a browser window can
lose focus while the mouse remains within the chart. Browsers may also hide
a document without emitting a matching window blur. Without handling either
transition, a planet/angle can remain highlighted until the next pointer event.
The user-selected (pinned) focus must survive both forms of focus loss.

## Narrow fix

- Observe `blur` on **the canvas owner's window**, not an unrelated global
  if the canvas belongs to another document. Also observe `visibilitychange`
  on the owning document and clear hover **only when hidden**; restoring a
  document never fabricates a new hover.
- A detached document with `defaultView=null` must not fall back to an
  unrelated global window. No global `window` or `document` is required
  when constructing the controller in Node-only probes.
- Reuse the existing `leave()` state machine to notify the host and restore
  the pinned or neutral visual focus. Suspend synthetic pointer moves/clicks
  after `window.blur` even when the document remains visible; resume when
  `window.focus` arrives **and** `document.hasFocus()` is true. Also suppress input while the owning document is
  hidden and resume on its `visibilitychange` to visible **only when**
  `document.hasFocus()` is true. Mere visibility must not resume a blurred window.
- Do not manipulate cameras, planet scales, aspects, render geometry or
  ephemeris positions.
- Ignore duplicate blur/hidden-document events if hover has already been retired,
  including either event synchronously emitted inside `onLeave`. The ordinary `leave()`
  increments the pointer revision even when idle, and calling it twice inside
  a callback could otherwise suppress the first leave's final repaint.
- Unregister the `blur`/`focus` listeners and the document `visibilitychange`
  listener from their exact owners during `destroy()`,
  without affecting any other active canvas or window.

## Deterministic regression

Run after installing the repository's locked dependencies:

```bash
npm ci
npm run test:planet-window-blur
npm run test:planet-interactions
```

`tests/planet-window-blur.test.mjs` transpiles the **actual** TypeScript
controller in memory and uses minimal Three.js and canvas/window event stubs.
It checks thirty-three cases: six window-blur cases (clearing hover, preserving
pinned DS, nested blur, independent owner windows, blur during pointer enter,
windowless Node construction) and five document-visibility cases (hidden
versus visible, pinned MC, nested hidden event during leave, detached
document with no owning window, hidden during pointer enter).
Three additional cases reject hidden-document pointer moves/clicks and nested
pointer moves during a hidden-document leave. Four further cases ensure a
blurred-but-visible window rejects input until focus returns, a visible tab
can resume without a separate window focus event, a hidden tab stays blocked
despite an early window focus, and blur leave callbacks cannot re-enter hover.
Four extra cases prove that becoming visible without document focus does not
resume mouse input, a premature focus event during a hidden tab cannot
clear the suspended-input latch, and synthetic/repeated window `focus`
events cannot bypass `document.hasFocus() === false`.
Seven new raycast regressions verify that a stale click/hover cannot be
emitted after a synchronous window blur, hidden-document transition,
controller destruction, or scene replacement during `pick()`. Four
additional regressions cover nested pointerleave/click, scene replacement,
controller destruction and a newer pointermove winning during hit testing.
A stable click remains selectable in the positive control. The implementation
checks the owner-window/scene/pointer revisions **after** `pick()`, not only
before starting the raycast.
The usual `test:planet-interactions` command includes this
new file. Synthetic axes are only identifiers; no real natal charts,
personal birth data or private assets are used.

**Validation status (2026-11-14): PASS, 33/33 dedicated Node tests.**
The exact controller and test files were reconstructed from the GitHub branch
and each local file's `git hash-object` matches its GitHub blob:
`148df6fcd5a51a52f90e677be86abf8c755c12d8` (controller) and
`bb79b310499d9dc91bdc7083b18b4a562558f87c` (test).
Running `node --test tests/planet-window-blur.test.mjs` with Node.js
**22.16.0** and TypeScript **5.8.3** yielded **33 pass, 0 fail, 0 skip**
(TAP duration ~571 ms). TypeScript `transpileModule` also returned **zero
diagnostics**. This test intentionally uses its committed Three.js/DOM event
stubs, so it is *not* an actual WebGL or Angular integration test.

The full repository checkout, `npm ci`, complete `test:planet-interactions`
and `npm run verify:angular` remain **NOT RUN**, because DNS prevented
checking out the complete repository in the isolated container.

## Browser acceptance and integration

This PR is stacked on **draft PR #22**. It is intentionally separate from
the legacy mouse helper work in PRs #42/#94. Opt-in browser acceptance should
also switch tabs/windows during live planet hover, observe a single leave,
verify pinned focus survives, then return and hover another planet.
Run Chromium and Firefox via `npm run test:demo-interactions`, plus the
independent natal AS/DS/MC/IC WebGL mouse-picking and keyboard gates in
draft PRs #54/#64. The browser and GPU checks are **NOT RUN** here.

Merge order: review and integrate #22 first, then rebase this PR to the new
main, run the complete Angular/browser checks, and review it separately.
No merge, deployment, npm publishing, GitHub Actions, licensed artwork,
Astrolabio firmware, or production system is modified.

## Hidden tab acceptance

When the chart's owning document changes `visibilityState` from `visible`
to `hidden`, the controller retires hover and preserves pinned selection.
A later `visible` notification does not simulate a new pointer enter.
A browser may fire `visibilitychange` and `window.blur` for the same
transition; the current hover state ensures only one leave notification.
Tests must also cover a detached owner document and window/iframe isolation.

On real Chromium and Firefox, manually hover AS, DS, MC and IC, switch tabs,
return to the chart, and check both the hover readout and focus/zoom.
The Node harness uses synthetic DOM event targets and **does not** prove
these visual outcomes without browser execution.

## Explicit pointer suspension gate (2026-11-14)

On a backgrounded or blurred window, a synthetic `pointermove` or `click`
must not reinstate focus or notify the host, even if it arrives synchronously
from an `onHoverLeave` callback. A `focus` event restores normal input
only when the owning document is visible and `document.hasFocus()` is true; a `visibilitychange` transition to
`visible` can restore input if `document.hasFocus()` is true, even if no
separate window focus event fires. A
window-focus event **cannot** bypass an owner document that is still hidden.

The dedicated `node --test` run described above executes the actual
committed test module and transpiles the complete committed controller,
including its real constructor, event listeners, `leave()` and `destroy()`.
The same tests previously passed in a smaller handler-only probe, but
**the Node run now supersedes that limited evidence**.

The earlier false-positive focus-resume behavior was reproduced before the
fix: a visible document reporting `hasFocus() === false` received
`window.focus`, incorrectly clearing the blur latch. The new guard requires
actual document focus.

The rest of the repository and real browser/Three.js integration still
need their own checks. For the complete integration gate, run:

```bash
npm ci
npm run test:planet-window-blur
npm run verify:angular
```

Chromium and Firefox should additionally verify transitions across windows
and tabs while a natal axis is hovered, with camera/zoom invariants inspected.
