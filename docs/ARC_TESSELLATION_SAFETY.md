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
- When UV bounding-box width/height is zero or nonfinite, use the neutral
  normalized UV coordinate `0.5` for that axis instead of NaN.

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
invalid radii, **synthetic texture material configuration**, and normalized UVs.
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

Keep the PR as a draft stacked on #62 until that parent is reviewed. No
GitHub Actions, license changes, asset publication or production changes.
