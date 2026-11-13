# Scene animation ownership and cleanup

Scene-local GSAP timelines are registered through `registerSceneAnimation(object, timeline)` in `src/lib/renderers/scene-animations.ts`. `GraficoRenderService` calls `stopSceneAnimations(object)` while traversing old scenes on redraw and teardown. The registry is a `WeakMap` keyed by scene object identity; no shared global timeline list or host-side state is introduced.

## Cleanup contract

- Registering the same timeline more than once **for the same object** does not schedule repeated `kill()` calls.
- Distinct timeline objects for the same scene object are stopped in registration order.
- `stopSceneAnimations(object)` is idempotent until another timeline is registered for that object.
- The registry entry is removed **before** external `kill()` methods run. If a callback registers a replacement during cleanup, that new timeline stays registered for the next cleanup; a nested `stopSceneAnimations(object)` does not recursively kill the previous timelines.
- Timelines registered against **different** objects remain independently owned. Callers should register a timeline against its actual owning object rather than intentionally sharing timelines between unrelated objects.

This change does not alter rendered geometry, animation speed, renderer disposal of Three.js materials, or public chart inputs. `kill()` exceptions still propagate: this update does not attempt to recover from failing third-party GSAP hooks. The full WebGL memory/visual lifecycle gate remains open under [issue #5](https://github.com/Cesare-ml/astrological-charts/issues/5).

## Regression check

After `npm ci`, run:

```bash
npm run test:scene-animations
npm run verify:angular
```

The Node test transpiles and runs the real TypeScript registry implementation without browser APIs; it does not prove WebGL resource disposal or PNG/chart correctness. Run browser redraw/export tests separately before merging into a rendering release. Do not deploy or modify VirgoStars/Astrolabio consumers as part of this test.
