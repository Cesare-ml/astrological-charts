# WebGL scene animation cleanup

The renderer associates GSAP timelines with the Three.js scene object that owns them through a weak registry in `src/lib/renderers/scene-animations.ts`. Scene teardown calls `stopSceneAnimations` as part of the existing disposal traversal; this file does not own or dispose Three.js geometries, materials or textures.

## Disposal contract

- Every registered timeline is given one `kill()` attempt for a particular cleanup generation.
- The registry is cleared **before** calling timelines. A nested `stopSceneAnimations` call therefore does not re-kill the same timeline, and repeated cleanup is safe.
- If one `kill()` throws, the remaining registered timelines still receive their kill attempts. Cleanup emits one console warning with the number of failures instead of throwing, so the caller can proceed to dispose the scene's GPU resources.
- Timelines registered after a completed stop form a new generation. Re-registering timelines during a `kill()` callback is not a supported lifecycle pattern: the owner should avoid creating new animations during teardown.
- This is defensive cleanup, not proof that a failing timeline has stopped. Inspect warnings and the underlying timeline error during development.

The change does not alter animation timing, chart geometry, rendering order, public chart inputs, zoom behaviour, astronomical calculations or asset ownership.

## Local verification

```bash
npm ci
npm run test:scene-animations
npm run test:scene-resources
npm run verify:angular
```

For WebGL validation, run the synthetic Angular demo and repeat natal/transit/synastry/latitude render and PNG export in real Chromium and Firefox. Review the JS console and GPU texture/object counts after many redraws. See `docs/ANGULAR_DEMO.md` and issue #5.

A Node test exercises the actual TypeScript animation module (via transpilation) with synthetic timeline objects; it verifies successful kills, exception isolation, reentrant stop and no-op cleanup. A second test extracts the **actual private** `disposeSceneResources` function from the Angular service with the TypeScript AST, transpiles it and injects synthetic Three.js resource objects. That regression checks shared-resource deduplication, error-tolerant animation cleanup, nested scene graphs, empty scenes, and independence between two scene roots (modeling an active chart plus a PNG export). The synthetic objects do not allocate real GPU resources. It does **not** run GSAP, real Three.js scenes, browsers, Astrolabio or production images. The repository's unresolved licensing gate still applies; no release, deploy or automated Actions are implied.


## Opt-in browser lifecycle acceptance

In a clean checkout run `npm ci`, `npm run demo:pack`, and start `npm run demo:assets` and `npm run demo` in separate terminals. Then:

```sh
npm run test:demo-webgl-lifecycle
```

This opt-in Playwright test is **not** in `preflight`. It requires real Chromium/Firefox, local manifest-verified synthetic assets and an Angular **development** build with `ng.getComponent` debugging. It performs 4 warmup renders, **50 alternating-skin natal redraws**, **20 PNG exports** across natal/transits/synastry/latitude, and temporarily renders a second chart through a separate `GraficoRenderService`. The export checks validate the 1600×1600 PNG header and that exporting does not change the active renderer, scene, camera or its tracked resources. It checks the second canvas retains its Three.js resource counts while the first is redrawn. The temporary service/canvas are disposed after the test. Browser errors, missing resources, failed renders and WebGL context loss fail the run.

Optional PowerShell configuration for a longer run and manually calibrated strict growth thresholds:

```powershell
$env:CHART_LIFECYCLE_REDRAWS = '100'
$env:CHART_LIFECYCLE_EXPORTS = '50'
$env:CHART_LIFECYCLE_MAX_TEXTURE_GROWTH = '0'
$env:CHART_LIFECYCLE_MAX_GEOMETRY_GROWTH = '0'
npm run test:demo-webgl-lifecycle
```

The redraw/export counts accept 1–100. With the two growth threshold variables unset, the script reports growth without enforcing an arbitrary threshold. It samples `renderer.info.memory` on the active renderer after a four-render warmup and after restoring the same natal/light skin. Set `CHART_TEST_BROWSER=firefox` and optionally `FIREFOX_PATH` to repeat with Firefox.

**Limitations:** Three.js memory counters report tracked geometries/textures and are **not GPU memory in bytes**. WebGL texture API calls do not prove that resources have been fully released. The second canvas test does not establish visual parity between independently rendered scenes. There is no evidence of successful real-browser execution until the command is actually run; passing a syntax/readback check is not a WebGL pass.
