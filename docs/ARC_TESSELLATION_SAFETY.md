# Bounded WebGL arc tessellation and finite UVs

**Stacked on PR #62** (`fix/line-stroke-bounded-segments-20261113`).
PR #62 handles line/dot/dash subdivisions; this child patch changes only the
separate ring/arc primitive `OggettiSempliciRender.getSemiArcoGrosso`.

## Problem

Previously both inner and outer `THREE.EllipseCurve` calls used
`getSpacedPoints(Math.trunc(b - a))`. Spans smaller than one degree
could provide zero divisions, and extremely large angles could request excessive
synchronous sampling. Degenerate bounding boxes also caused UV computation
to divide by zero, producing NaN texture coordinates.

## Behavior

- Preserve the former tessellation for normal integer spans from 2 to 720
  degrees (including the usual 30-degree zodiac wedges and 360-degree rings).
- Clamp smaller finite spans to **2 subdivisions** and larger finite spans to
  **720 subdivisions**. Clockwise/negative spans use their absolute width for
  subdivision count. Before creating an `EllipseCurve`, normalize its start
  modulo 360 degrees and reduce its sweep to at most one turn. A nonzero sweep
  equal to a whole number of turns remains one full 360-degree rotation.
- Reject nonfinite angles or overflowed angular spans with `RangeError`.
- Reject nonfinite or negative inner/outer radii **before** Three.js curve sampling. Preserve reversed radial bands (including outer radius zero), which are intentionally used by the aspect-center fill.
- Reject radii which are finite JavaScript doubles but overflow the Float32 position buffers used by Three.js (for example `1e39`). Preserve representable large radii and the existing reversed-center band.
- When UV bounding-box width/height is zero or nonfinite, use the neutral
  normalized UV coordinate `0.5` for that axis instead of NaN.
- On a **synchronous** texture lookup or mesh-construction failure, release the newly created arc geometry and material before rethrowing. Leave textures returned by the shared `GestoreImmagini` cache alone; asynchronous loader errors require the caller's existing wait/error handling.
- Apply the same geometry disposal to synchronous **bounding-box** and **UV attribute** initialization failures, before any texture is requested. A successful arc retains ownership of its own buffers for the normal renderer lifecycle.
- A **single ownership guard** now handles synchronous UV preparation, texture configuration and mesh construction failures. New regression fixtures count disposal invocations, assert that geometry/material are released **exactly once**, and verify that a failure in `texture.repeat.set` preserves the host-owned texture.

This patch does **not** alter astrology, the chart's zoom, the skin asset URLs,
planet/house positions or public TypeScript APIs. For unusual fractional spans,
sampling can become denser, intentionally. Huge angular inputs are reduced
both in **sample count** and **actual Three.js curve endpoints**, avoiding
repeated 2π subtraction in `EllipseCurve.getPoint()` (Three.js r170).
Descending inputs use `clockwise: true` to draw the requested short clockwise
span instead of accidentally drawing almost 360 degrees. Callers should
still pass physically meaningful ring angles.

## Check from a complete checkout

```sh
npm ci
npm run test:render-primitives   # both #62 line strokes and #87 arc/UV regressions
npm run verify:angular          # preflight now invokes test:render-primitives too
```

The focused Node test evaluates the actual TypeScript renderer with instrumented
Three.js geometry stubs, checking normal/short/reversed/degenerate/oversized arcs,
invalid radii (including `Float32` overflow), **synthetic texture material configuration**, and normalized UVs.
The suite also exercises all 12 zodiac wedges at six synthetic ascendant offsets
(72 cases, including negative and greater-than-360-degree positions), plus four
edge-radius/upper-bound cases. Its ellipse stub now follows the Three.js r170
angle-wrapping/clockwise semantics, and explicitly checks that extreme angles
are canonicalized before those loops run. These provide deterministic geometric regression
checks, not a browser pixel/skin comparison.
It also checks that invalid textured arcs fail before any texture lookup. Tests use
placeholder references only; no artwork or host asset server is required. The test is **not** an actual WebGL render, screenshot
baseline, browser performance study, VirgoStars integration, or Astrolabio
hardware validation. Those remain mandatory acceptance gates before merging
or deploying anything.

The package's `preflight` script now runs both line-stroke and arc regression suites via `test:render-primitives`. This checks the actual TypeScript source with synthetic Three.js implementations; it does not replace Chromium/Firefox rendering or a live site comparison.

**Integration coordination:** this PR additionally changes `package.json`, which is also edited by open PRs #19, #22, #57, #59 and #66. Re-check their scripts and preserve all intended preflight checks when rebasing/merging. Do not auto-resolve such conflicts by taking one side wholesale.

## Validation performed (2026-11-14)

**Latest: PASS 26/26 (exit 0), Node.js 22.16.0 / TypeScript 5.8.3.**
Executed both **exact committed Node test files** in a single local `node --test` run:

- `tests/arc-tessellation-safety.test.mjs` (#87): **20/20 PASS**. Git blob SHA-1 matched `4593ba65bdd8588a7ff28c5e891344468504146c`.
- `tests/line-stroke-safety.test.mjs` (parent #62): **6/6 PASS**. Git blob SHA-1 matched `667ed3551e2271d6b7842b159a5de5f1d362e082`.
- Source: reconstructed a minimal TypeScript class containing exact **copied method bodies** from the #87 branch, not an approximation. Verified FNV-1a checksums against GitHub readback: arc methods `e20ad611` (4,499 chars); stroke-count `a9f96b88` (692); dashed stroke `3b3adf8c` (787); line-and-dot stroke `cfdb0742` (2,964). The auxiliary class omits unrelated methods and imports.
- Exact local command: `node --test tests/line-stroke-safety.test.mjs tests/arc-tessellation-safety.test.mjs`.
- TAP result: **26 pass, 0 fail, 0 skipped, exit 0**. Local output log SHA-256: `5617480c54ef65f91f1756f7211b23feca927cc32733ae0021510e74bb1cedd4` (elapsed timing may vary).

The latest run includes a synthetic texture-transform setter failure and exactly-once disposal assertions. Earlier smaller offline runs (6/6, 10/10, 13/13) preceded this result; an initial 8/9 failure caught a shadowed material variable, which was fixed in the branch before the latest passing run.

**Scope limitation:** the *committed test files* were executed against the exact GitHub-readback methods in a local extracted-method workspace, **not a complete Git checkout**. The standard `npm run test:render-primitives` script, `npm ci`, `npm run verify:angular`, Chromium/Firefox rendering, and PNG visual baselines remain **NOT RUN** from a clean checkout. GitHub DNS/network access is blocked from the execution shell; the tests simulate Three.js geometry. This does **not** prove Angular build success, pixel parity, real texture loading, or Astrolabio compatibility.

Keep the PR as a draft stacked on #62 until that parent is reviewed. No
GitHub Actions, license changes, asset publication or production changes.
