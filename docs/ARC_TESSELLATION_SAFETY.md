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
  subdivision count; their actual input angles are left untouched.
- Reject nonfinite angles or overflowed angular spans with `RangeError`.
- Reject nonfinite or negative inner/outer radii **before** Three.js curve sampling. Preserve reversed radial bands (including outer radius zero), which are intentionally used by the aspect-center fill.
- When UV bounding-box width/height is zero or nonfinite, use the neutral
  normalized UV coordinate `0.5` for that axis instead of NaN.

This patch does **not** alter astrology, the chart's zoom, the skin asset URLs,
planet/house positions or public TypeScript APIs. For unusual fractional spans,
sampling can become denser, intentionally. Huge angular spans are capped in
sample count, not geometrically normalized; callers should still pass sensible
angles.

## Check from a complete checkout

```sh
npm ci
node --test tests/arc-tessellation-safety.test.mjs
npm run verify:angular
```

The focused Node test evaluates the actual TypeScript renderer with instrumented
Three.js geometry stubs, checking normal/short/reversed/degenerate/oversized arcs,
invalid radii, **synthetic texture material configuration**, and normalized UVs.
It also checks that invalid textured arcs fail before any texture lookup. Tests use
placeholder references only; no artwork or host asset server is required. The test is **not** an actual WebGL render, screenshot
baseline, browser performance study, VirgoStars integration, or Astrolabio
hardware validation. Those remain mandatory acceptance gates before merging
or deploying anything.

Keep the PR as a draft stacked on #62 until that parent is reviewed. No
GitHub Actions, license changes, asset publication or production changes.
