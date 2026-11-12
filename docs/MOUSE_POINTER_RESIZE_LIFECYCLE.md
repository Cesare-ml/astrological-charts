# Mouse pointer coordinates and canvas lifecycle

This note covers the **internal** `GestoreEventiMouse` helper in `src/lib/renderers/@gestore-eventi-mouse.ts`. It does not alter the existing public `grafici-astrologici` exports or the new natal/transit interaction controller being developed separately in PR #22. It is a preventive correction for code paths that instantiate this legacy helper.

## Problem

The previous `resize` callback treated the already-normalized Three.js mouse vector as if it contained original `clientX/clientY` pixel coordinates. Every resize could therefore shift the raycast point and cause hover or click behavior to target the wrong object.

The handler also kept hover state after `mouseleave`, and did not explicitly send a leave event or clear the stored hover when destroyed.

## New contract

`mousePositionToNdc(clientX, clientY, rect)` is a pure, internal-coordinate helper:

- Maps the **actual last client pixel position** into Three.js NDC (`x` from -1 to 1 and `y` from 1 to -1).
- Rejects non-finite numbers, zero/negative rectangle dimensions, and positions outside the canvas. An invalid/outside position never triggers a raycast or a click.
- Does not modify camera zoom, scene objects, transforms, canvas dimensions, or aspect geometry.

`GestoreEventiMouse` now remembers the last screen pixel coordinates, recomputes the NDC from the current canvas rectangle after a resize, and re-evaluates hover only when the position remains inside the canvas. `mouseleave` clears the last pointer and emits a single leave event; `distruggi()` removes all attached mouse/resize listeners and also clears active hover. Repeated leave/teardown must not emit duplicate notifications.

A canvas resize that brings the stored pixel position inside or outside its newly sized rectangle can transition hover without further mouse movement. This is deliberate and preserves correct raycast coordinates.

## Local validation

```bash
npm ci
node --test tests/mouse-pointer-lifecycle.test.mjs
npm run check:types
npm run verify:angular
```

The isolated Node test transpiles the **actual** internal TypeScript module and uses fake Three.js raycasters plus synthetic canvas/window events. This verifies pointer math and listener bookkeeping without relying on a GPU. It does **not** establish browser rendering correctness.

Before integrating this helper into a new interaction path, additionally validate actual Chromium/Firefox mouse picking, hover leave after resize, disabled/offscreen canvases, WebGL context loss, AS/DS/MC/IC selection and that no planet zoom/scale changes occur.

## Compatibility and scope

No public API changes, assets, font redistribution, astronomical calculations, production VirgoStars / Astrolabio writes, deployments or GitHub Actions. This correction is independently reversible and must remain Draft until an actual Node run and maintainer review.
