# Latitude chart: selected house system unavailable

The latitude chart should not assume that a nonempty `temaRender.houses` object
contains `opzioni.settaggi.domificazione_selezionata`.

## Before / after

- **Before:** a theme with `houses.placido` but `domificazione_selezionata =
  'egizia'` threw when the renderer dereferenced `houses.egizia.ascendant`.
  The latitude chart and PNG export could fail even though planet positions
  were available.
- **After:** the renderer checks only the **selected** house system. If it is
  missing, it omits the house ring while retaining the background, zodiac ring,
  and latitude planet markers. As in the existing completely house-less mode,
  it uses the fallback zodiac rotation reference `as = 0`. It never silently
  substitutes another house system or computes astronomical houses.
- **Unchanged:** a present selected house system uses its original Ascendant
  and house ring; the effemeridi mode still omits house divisions. No input
  theme is modified. No public types, skin assets, or package exports change.

This is a missing-system guard, **not** validation of a malformed selected
house object. A selected system with incomplete cusps or invalid angular
values requires a separate input-contract check. A 0° fallback rotation does
not represent a computed Ascendant; consumers requiring actual house axes
must supply the selected house system.

## Reproducible checks

The fixture is synthetic, with `placido` house data and `egizia` selected.
`tests/latitude-missing-houses.test.mjs` extracts and transpiles the actual
`LatitudiniRender.creaScena` method, stubs only its render dependencies and
checks missing, present, empty and absent houses plus the effemeridi override.
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
