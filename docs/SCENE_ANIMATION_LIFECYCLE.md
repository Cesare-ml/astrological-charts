# Scene animation ownership and cleanup

Scene-local GSAP timelines are registered through `registerSceneAnimation(object, timeline)` in `src/lib/renderers/scene-animations.ts`. `GraficoRenderService` calls `stopSceneAnimations(object)` while traversing old scenes on redraw and teardown. The registry is a `WeakMap` keyed by scene object identity; no shared global timeline list or host-side state is introduced.

## Cleanup contract

- Registering the same timeline more than once **for the same object** does not schedule repeated `kill()` calls.
- Distinct timeline objects for the same scene object are stopped in registration order.
- `stopSceneAnimations(object)` is idempotent until another timeline is registered for that object.
- The registry entry is removed **before** external `kill()` methods run. If a callback registers a replacement during cleanup, that new timeline stays registered for the next cleanup; a nested `stopSceneAnimations(object)` does not recursively kill the previous timelines.
- Timelines registered against **different** objects remain independently owned. Callers should register a timeline against its actual owning object rather than intentionally sharing timelines between unrelated objects.
- If a timeline's `kill()` throws, cleanup continues to attempt `kill()` on all remaining timelines registered for that object. One failure is rethrown unchanged; multiple failures are reported as an `AggregateError` in registration order. The stopped batch remains unregistered even when errors occur. A replacement registered from inside a failing `kill()` is retained for a later stop.

This change does not alter chart geometry, animation speed or public chart inputs. Errors are still reported after cleanup has been attempted.

## Three.js scene and renderer cleanup

`GraficoRenderService.disposeSceneResources` attempts to stop animations for **all** traversed scene objects before releasing unique textures, materials and geometries. An exception from one animation or resource `dispose()` no longer skips the remaining resources. A single failure is thrown unchanged; multiple failures become an `AggregateError` in encounter order. Success-path disposal order remains textures, materials, geometries.

`GraficoRenderService.ngOnDestroy()` also attempts `scene.clear()` and WebGL renderer `dispose()` and clears the service's renderer/scene/camera references even if scene cleanup, resize unsubscription or renderer disposal fails. Multiple errors are reported together.

**Limits:** these fast Node tests use the real TypeScript helper/method extracted by AST, synthetic disposable objects and a minimal `THREE.Texture` stub. They do **not** create a WebGL context or prove GPU driver resources have been released. The redraw and PNG-export call-site failure paths are not covered by this particular increment; validate those paths in dedicated browser/renderer acceptance before release. The full WebGL memory/visual lifecycle gate remains open under [issue #5](https://github.com/Cesare-ml/astrological-charts/issues/5). The full WebGL memory/visual lifecycle gate remains open under [issue #5](https://github.com/Cesare-ml/astrological-charts/issues/5).

## Regression check

After `npm ci`, run:

```bash
npm run test:scene-animations
npm run test:scene-resources
npm run verify:angular
```

Both Node suites transpile the actual TypeScript functions using the installed TypeScript compiler without browser APIs; they do not prove WebGL resource disposal or PNG/chart correctness. Run browser redraw/export tests separately before merging into a rendering release. Do not deploy or modify VirgoStars/Astrolabio consumers as part of this test.
