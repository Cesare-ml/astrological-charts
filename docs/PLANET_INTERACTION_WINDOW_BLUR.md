# Interactive chart: window blur and pointer focus lifecycle

## Issue

The pending `PlanetInteractionController` in draft PR #22 listens for
`pointerleave`, `pointercancel`, and canvas clicks, but a browser window can
lose focus while the mouse remains within the chart. Without a matching
window-blur transition, the hovered planet/angle can remain highlighted until
the next pointer event. The user-selected (pinned) focus must survive blur.

## Narrow fix

- Observe `blur` on **the canvas owner's window**, not an unrelated global
  if the canvas belongs to another document. No global `window` is required
  when constructing the controller in Node-only probes.
- Reuse the existing `leave()` state machine to notify the host and restore
  the pinned or neutral visual focus. Do not manipulate cameras, planet scales,
  aspects, render geometry or ephemeris positions.
- Ignore duplicate blur events if hover has already been retired, including
  a blur synchronously emitted inside `onLeave`. The ordinary `leave()`
  increments the pointer revision even when idle, and calling it twice inside
  a callback could otherwise suppress the first leave's final repaint.
- Unregister the exact listener from its owning window during `destroy()`,
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
It checks six cases: clearing hover after blur, preserving a pinned DS,
deduplicating nested blur, two owner windows with independent disposal,
blur during an AS/DS/MC/IC pointer-enter callback, and a windowless Node
constructor. The usual `test:planet-interactions` command includes this
new file. Synthetic axes are only identifiers; no real natal charts,
personal birth data or private assets are used.

**Validation status for this change:** Source, test, docs and script are
committed through the GitHub connector; a full repository checkout and the
`npm ci` / `npm run verify:angular` gates were **NOT RUN** in this session
because the isolated local container cannot resolve GitHub hosts. Do **not**
claim the six cases passed on the exact GitHub tree without running the test
command from a real checkout.

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
