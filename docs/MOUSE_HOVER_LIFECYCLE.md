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

Coverage: mouse leave, re-entry, blur + leave deduplication, teardown listener
removal, and synchronous callback reentrancy. The existing click and hit-testing
contract is intentionally unchanged.

## Scope and remaining gates

This is a lifecycle regression for the legacy helper, not a browser-proof of
picking, chart geometry, or the newer interactive glyph renderer proposed in
PR #22. In particular, a real browser acceptance pass should still verify
canvas hover/focus and no unexpected camera zoom in Chromium and Firefox.
PR #42 independently fixes normalized raycast coordinates after resize; this
change does not change that coordinate calculation.

No production consumers, visual assets, Angular framework integration,
deployment, or Astrolabio firmware are modified. Before integration, run
`npm run verify:angular` in a complete checkout and record browser evidence
as required by `CONTRIBUTING.md`.
