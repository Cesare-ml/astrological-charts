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

For rendering parity, additionally run the interactive Angular demo's
Chromium/Firefox synthetic browser suites (see `docs/ANGULAR_DEMO.md`), and
visually compare the result with an approved baseline before integrating with
VirgoStars web/mobile or the Astrolabio e-ink path. No production migration,
automatic merge or deployment is part of this fix.
