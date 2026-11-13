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

`GraficoRenderService.disposeSceneResources` first snapshots the scene object identities and unique textures, materials and geometries **before** invoking any external animation `kill()` hook. This prevents a timeline that detaches a sibling or nulls out geometry/material references from hiding those resources from cleanup. Once ownership has been captured, it attempts to stop animations for **all** snapshot objects, then releases the captured resources. If a legacy geometry/material getter or a material texture-property getter throws during the snapshot, that error is retained, while subsequent accessible objects and resources are still processed. Texture properties are inspected one at a time in enumerable-key order: a failing getter does not conceal later textures **on the same material**, and multiple getter failures are reported in their original encounter order. If enumerating the material's keys fails entirely, only textures already discovered from that material can be released. If scene traversal itself throws, cleanup proceeds for the nodes and resources captured **before** the traversal failure; unreachable nodes cannot be guaranteed disposed. An exception from one animation or resource `dispose()` no longer skips the remaining resources. A single failure is thrown unchanged; multiple failures become an `AggregateError` in encounter order. Success-path disposal order remains textures, materials, geometries.

`GraficoRenderService.ngOnDestroy()` also attempts `scene.clear()` and WebGL renderer `dispose()` and clears the service's renderer/scene/camera references even if scene cleanup, resize unsubscription or renderer disposal fails. Before performing any external teardown, it also resets the pending animation-frame ID and resize subscription handles to `null`, preventing repeated cancellation or unsubscribe during a later destroy. An exception from `cancelAnimationFrame()` is captured and reported after the other cleanup attempts, rather than stopping the teardown immediately. Multiple errors are reported together.

## Redraw and PNG-export cleanup

`GraficoRenderService.disegnaScena()` owns a newly constructed scene group until it has been attached to the live scene. On texture-wait failure, a stale generation, a failed previous-scene cleanup or a failed scene setup, the unadopted group is disposed. The old scene's `clear()` is attempted even if `disposeSceneResources()` throws. When both the redraw and its candidate cleanup fail, an `AggregateError` preserves both original failures. A successfully adopted group remains owned by the live scene, even if the subsequent render throws; later scene teardown will release it.

`generaImmagineInterna()` releases the offscreen renderer after attempting to dispose and clear its scene even when PNG rendering, texture waiting or cleanup throws. This also applies if construction of the offscreen `THREE.Scene` itself throws after the renderer is created. If `scene.add(disegno)` fails before the drawing is attached, the offscreen method explicitly disposes that otherwise-orphaned drawing; if the drawing was already inserted into `scene.children` before an exception, the scene's own cleanup retains responsibility to avoid double disposal. The original export/attachment error is retained; if drawing, scene or renderer cleanup also fails, errors are reported together in encounter order. On the success path, dimensions, drawing order and the PNG data URL are unchanged.

**Limits:** fast Node regressions execute the real TypeScript helpers/methods extracted by AST using synthetic scenes, resource stubs and no WebGL context. They do **not** prove actual GPU memory reclamation, screenshot parity, headless PNG parity or consumer compatibility. Real-browser redraw/export, Firefox/Chromium, mobile and Astrolabio checks remain mandatory before integration. The wider WebGL lifecycle gate remains open under [issue #5](https://github.com/Cesare-ml/astrological-charts/issues/5).

## Regression check

After `npm ci`, run:

```bash
npm run test:scene-animations
npm run test:scene-resources
npm run test:scene-redraw-export
npm run verify:angular
```

The three Node suites transpile the actual TypeScript helpers/methods with the installed TypeScript compiler and synthetic dependencies; they do not prove WebGL resource disposal or PNG/chart correctness. Run browser redraw/export tests separately before merging into a rendering release. Do not deploy or modify VirgoStars/Astrolabio consumers as part of this test.

For optional real-browser checks of repeated redraws, PNG exports and two canvases, see [WebGL browser lifecycle acceptance](WEBGL_BROWSER_ACCEPTANCE.md). This gate runs separately from Node `preflight` and does not claim physical GPU memory measurement.
