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
npm run verify:angular
```

For WebGL validation, run the synthetic Angular demo and repeat natal/transit/synastry/latitude render and PNG export in real Chromium and Firefox. Review the JS console and GPU texture/object counts after many redraws. See `docs/ANGULAR_DEMO.md` and issue #5.

A Node test exercises the actual TypeScript module (via transpilation) with synthetic timeline objects; it verifies successful kills, exception isolation, reentrant stop and no-op cleanup. It does **not** run GSAP, real Three.js scenes, browsers, Astrolabio or production images. The repository's unresolved licensing gate still applies; no release, deploy or automated Actions are implied.
