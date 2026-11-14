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

- **PASS, Node.js 22.16.0:** three offline Node files run together using `node --test`, **13/13 passed (exit 0)**, covering 72 zodiac wedges, edge inputs, texture/material failures, bounding-box/UV errors, and recovery after an error. The checked code is a recreated TypeScript method excerpt from the branch, not a checked-out full repository; synthetic Three.js objects were used.
- **PASS, TypeScript transpilation diagnostics:** `ts.transpileModule` of the offline method excerpt reported no diagnostics. This is not a full Angular type-check.


- **PASS, Node.js 22.16.0 / TypeScript 5.8.3:** an **offline focused smoke harness** was actually executed with `node --test`, using the manually reconstructed, functionally identical arc method excerpt read from GitHub (not a complete checkout). Six Node test blocks passed, including 72 synthetic zodiac wedges at six ascendant offsets, full/reversed/zero/huge angles, a reversed-radius center-disc fill, Float32-overflow rejection and large Float32-representable radii. Lightweight Three.js behavior was simulated; no real WebGL or production textures were loaded. The local test file is not part of this PR.
- **PASS, source-level isolation:** six new Float32-focused checks executed against the exact GitHub-readback methods in the connected JavaScript runtime with synthetic geometry stubs. Includes three nonfinite/overflow cases plus valid large and zero radii.
- **PASS, local offline regression harness:** Node.js 22.16.0, ten Node test blocks (10 passed, 0 failed, exit 0) using the reconstructed arc-method excerpt and synthetic geometry stubs. This additionally checks failed texture lookup, failed mesh construction, successful ownership and that a shared texture is never disposed when only the arc's geometry/material belong to this call. The first run caught a shadowed `material` declaration (8/9 tests); it was fixed in the GitHub branch and the rerun passed 10/10. This offline harness is **not the committed Node test suite**.
- **NOT RUN:** the **committed** `npm run test:render-primitives` scripts, actual `npm ci`, complete `npm run verify:angular`, Chromium/Firefox WebGL/PNG benchmarks, or VirgoStars/Astrolabio compatibility. The full repository/dependency checkout cannot be accessed from the execution shell due DNS/network limits. Neither offline smoke nor source-level isolation satisfies those release gates.

Keep the PR as a draft stacked on #62 until that parent is reviewed. No
GitHub Actions, license changes, asset publication or production changes.
