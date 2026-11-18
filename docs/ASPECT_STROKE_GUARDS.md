# Aspect stroke safety and regression scope

`OggettiSempliciRender.getLineaGrossaTratteggiata` and `getLineaGrossaPuntoLinea` construct line geometries synchronously. A zero or non-finite `passo` previously permitted unbounded loops (and potentially froze a browser). Both functions now require a positive finite step and finite distance and limit requested primitives to **20,000 per call**.

Line/point counts must be non-negative safe integers and spacing must be finite and non-negative. An empty pattern returns an empty Three.js group. Dot-only patterns (`nLinee: 0`) no longer divide by zero: pattern length is computed without the old division by `nLinee`. This preserves the math used for standard nonzero-line chart aspects (quinconce, quintiles, parallels and semi-squares). Excessively dense patterns intentionally throw `RangeError` rather than attempting an unbounded allocation.

## Focused check

```sh
node --test tests/line-stroke-safety.test.mjs
```

This test reads and transpiles the actual TypeScript source using installed `typescript`. It substitutes small Three.js objects to inspect segment counts and finite vertex coordinates. It is not a browser/WebGL test. For integration, run `npm ci && npm run verify:angular` and compare Chromium/Firefox output for natal, transit, synastry and latitude modes with approved fixtures. No production consumer or e-ink device is changed by this PR.

The 20,000-primitive limit is a renderer safety bound, not an adjustable skin setting. If a real consumer legitimately requires denser patterns, evaluate its effect on WebGL allocation and redraw timing before changing the limit.
