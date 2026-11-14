# Declination aspect matching — focused renderer correction

The chart renderer accepts already-computed planetary coordinates. It does **not** calculate astronomical declinations or ephemerides.

## Before and after

In `AspettiRender.getArchi` (single chart) and `getArchiDoppioTema` (two-chart comparison), aspect labels `parallelodideclinazione` and `antiparallelo` have historical placeholder angular values of -1 and -2 degrees in `Settaggi.aspetti`. These are **grouping keys**, not ecliptic-longitude separations.

Before the fix, both names accidentally passed through the generic longitude matcher. Two planets at 10° and 12° longitude could therefore draw a “parallel” even with **no declination supplied**. In the two-chart comparison, there was also no declination-specific branch, so the fake longitude match was its only path.

Now:
- `parallelodideclinazione` requires both declinations and an absolute difference **strictly below 1°**;
- `antiparallelo` requires both declinations and an absolute **sum strictly below 1°**;
- missing declinations do not create either aspect;
- the existing longitude logic is unchanged for conjunction, opposition, sextile, square, trine and other longitude-defined aspects;
- two-chart comparisons use the same declination conditions as single-chart rendering.

The existing strict 1° threshold is deliberately preserved. This PR does not change configured longitude orbs, aspect line styling, zodiac coordinates or any public API. It does not introduce a new astronomical algorithm.

## Synthetic regression

Run from the repository checkout after `npm ci`:

```bash
npm run test:aspects
```

The Node test extracts and transpiles the **actual** two static renderer methods to check matching without requiring WebGL, Angular or images. Both methods must reject longitude-only false positives, recognize real parallels/antiparallels, handle one-sided/missing/null/non-finite input, preserve strict 1° thresholds and retain ordinary conjunctions, including the 359°/1° seam. The `test:aspects` command also runs inside `npm run preflight` and therefore `npm run verify:angular`.

A separate isolated V8 execution of both GitHub-branch method bodies on 2026-11-14 passed 16/16 focused assertions; the two methods on `main` each reproduced the longitude-only false positive. This is **not** equivalent to running the repository Node test or Angular/browser suite.

## Visual acceptance and integration

Expected visual difference: charts with `parallelodideclinazione` or `antiparallelo` enabled should no longer show spurious aspect chords for unrelated/missing declination data. Real declination matches remain. Other aspect lines and chart layout should be unchanged.

Affected flows: natal aspect circle and two-chart aspect circle when declination aspects are enabled, including VirgoStars and Astrolabio once separately integrated. Validate using synthetic charts with and without `equatoriale.declination`, both light/dark skins, and Chromium/Firefox PNG snapshots. For the full integration gates also run `npm run verify:angular`, `npm run test:demo` and downstream headless/e-ink checks. No production consumer is changed by this branch.

Rollback: close/revert this isolated PR; no schema, assets, deployment or package publication changes.
