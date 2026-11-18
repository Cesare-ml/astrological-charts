# Latitude chart: selected house system unavailable

The latitude chart should not assume that a nonempty `temaRender.houses` object
contains `opzioni.settaggi.domificazione_selezionata`.

## Before / after

- **Before:** a theme with `houses.placido` but `domificazione_selezionata =
  'egizia'` threw when the renderer dereferenced `houses.egizia.ascendant`.
  The latitude chart and PNG export could fail even though planet positions
  were available.
- **After:** the renderer checks only the **selected** house system, requiring
  a finite numeric Ascendant and an array of exactly 12 finite numeric cusp
  angles. If the selection is absent, incomplete or has nonnumeric coordinates,
  it omits the unsafe house ring while retaining the background, zodiac ring
  and latitude planet markers. As in the existing house-less mode, it uses
  the fallback zodiac rotation reference `as = 0`.
- **Unchanged:** a complete selected house system, including a legitimate
  `ascendant = 0`, keeps its original Ascendant and house ring. Ephemerides
  mode still omits house divisions. No input theme is modified. No public
  types, skin assets, or package exports change.

These checks validate only **basic input completeness**: they do not verify
the cusp sequence's astronomical consistency, house system provenance, or
visual correctness. A malformed but finite 12-cusp sequence may still require
validation by the shared house renderer. The 0° fallback does **not** represent
a computed Ascendant; consumers requiring actual house axes must supply the
requested house system. The renderer never silently substitutes another
domification or calculates astronomical houses.

## Reproducible checks

The fixture is synthetic, with `placido` house data and `egizia` selected.
`tests/latitude-missing-houses.test.mjs` extracts and transpiles the actual
`LatitudiniRender.creaScena` method, stubs only its render dependencies and
checks missing, present, empty, absent and malformed house inputs (including\n0° Ascendant, NaN/Infinity, short and sparse cusps), plus the effemeridi override.
It does **not** prove GPU output, asset fidelity or device compatibility.

```sh
npm ci
npm run test:latitude-missing-houses
npm run verify:angular
```

## Targeted Node validation (2026-11-14)

A local **minimal snapshot** was created for the actual source of
`LatitudiniRender.creaScena` and the committed regression test. This is
deliberately narrower than an installed repository checkout:

- GitHub's regression test blob SHA and the local file's Git SHA both equal
  `7a47e572fe1b6ad3b9957de3a27ec09bf4b4b779` (byte-for-byte identical).
- The scene method extracted from the GitHub renderer and the locally
  reconstructed method both contain 3,295 characters and match the same
  FNV-1a 64-bit check value `da59c413bf1cc94`. This check covers the method
  body, **not** the imports or the rest of the renderer file.
- With Node.js `22.16.0` and the actual TypeScript `5.8.3` compiler,
  `node --test tests/latitude-missing-houses.test.mjs` completed **11/11
  PASS**, **0 FAIL**, exit code 0. Those cases cover missing/valid/malformed
  selected houses, 0° Ascendant, transit ring count, southern inversion and
  the ephemerides override.
- This test intentionally mocks Three.js groups and collaborating renderers:
  there are no real textures, WebGL pixels, Angular component execution or
  actual ephemeris calculations in this result.

**NOT RUN:** fresh `npm ci`, full `npm run preflight`, `npm run
verify:angular`, Chromium/Firefox browser suites and genuine Astrolabio
device/e-ink verification. The local environment cannot clone GitHub over
network, so these gates must be rerun on a complete checkout before merging.

## Sparse arrays with inherited cusp values (2026-11-14)

All twelve cusps must be **own numeric array entries**. Checking
`Array.from(house).every(Number.isFinite)` was not sufficient: a sparse array
could inherit a finite value from a custom prototype at a missing index.
The renderer now uses `Object.prototype.hasOwnProperty.call` for each of the
twelve positions and rejects inherited entries, while preserving valid
ordinary arrays and the 0° Ascendant.

Regression: `an inherited cusp cannot disguise a sparse selected house array`
deliberately creates a hole at index 5, supplies an inherited finite value
at the same index, and confirms that planets and signs remain visible
**without** the house ring.

The test was executed on a local isolated Node 22.16.0 / TypeScript 5.8.3
snapshot of the scene method and committed test body: **12/12 PASS**, exit 0.
The isolated test specifically **FAILS with the pre-fix selection guard**
(exit 1) and PASSES with the corrected guard. Full Angular/WebGL suites remain
NOT RUN; see the release gates above.

## Selected house systems must be explicit (2026-11-14)

The selected house system is now read only from an **own** key of
`temaRender.houses`. A prototype-inherited `egizia` (or any other selected
system) must not accidentally supply a house ring or rotate the chart.
The check still accepts legitimate own keys on null-prototype lookup maps,
and preserves the normal 12-number cusp contract verified against
`demo/fixtures.ts` and `CaseRender.renderAnelloCaseLatitudini`.

The new regression tests exercise both cases. On the exact committed
`LatitudiniRender.creaScena` body, a source-backed isolated V8 harness
recorded **14/14 passing test bodies** (0 failed); its TypeScript AST/transpile
and Three.js dependencies are mocked. The inherited-system case was also
confirmed to **draw the wrong ring before** this correction and **skip it
afterward**. These results are not a fresh `node --test`, full Angular
build or Chromium/Firefox run, and do not replace those validation gates.

## Browser PNG regression

The existing `tests/fixtures/latitude-transits-harness.ts` now accepts an
optional `missingSelectedHouses` parameter. Its default remains unchanged.
When enabled, synthetic natal and transit themes contain `placido` house
data while the graph explicitly selects `egizia`.

The `latitude charts with transits` case in `tests/demo-browser.test.mjs`
exports both variants for all **seven skins**, checks PNG contents are not
blank, and compares decoded pixel buffers to detect a visual difference.
The missing-selected-house variant also uses the established 0° rotation
fallback; therefore a pixel difference **alone does not prove** that the
house ring was removed. The isolated scene assertions separately verify
that `CaseRender.getAnelloCaseLatitudini` is not called. The browser test
allows 180 seconds for all 14 exports and remains part of
`npm run test:demo`;
the Angular demo and manifest-verified asset server must both be running.

```sh
npm run demo:pack
npm run demo:assets
# In a second terminal:
npm run demo
# In a third terminal:
npm run test:demo
```

This is a browser regression specification, not evidence of a completed
browser run. Screenshot and device compatibility must still be reviewed.

For rendering parity, additionally run the interactive Angular demo's
Chromium/Firefox synthetic browser suites (see `docs/ANGULAR_DEMO.md`), and
visually compare the result with an approved baseline before integrating with
VirgoStars web/mobile or the Astrolabio e-ink path. No production migration,
automatic merge or deployment is part of this fix.
