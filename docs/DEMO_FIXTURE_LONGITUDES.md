# Deterministic demo longitudes

The Angular chart demo generates **illustrative**, not astronomical, input
themes with `makeDemoTheme(offset)` in `demo/fixtures.ts`. The production
renderer does not use this generator. The three built-in demo charts continue
to use the unchanged offsets `0`, `24` and `71`.

## Input contract and correction

A JavaScript `%` remainder is negative for negative numbers. Before this
change, `makeDemoTheme(-90)` returned invalid negative ascendant and some
planet longitudes even though a chart angle belongs in the range **[0, 360)**.
A NaN/Infinity offset also propagated invalid values to house and planet
coordinates and could make visual regression results meaningless.

- All generated ascendant, descendant, MC, IC, vertex, twelve house cusps
  and planet longitudes now wrap into **[0, 360)**.
- Offsets must be finite JavaScript numbers. NaN, infinities and nonnumeric
  runtime values fail early with `TypeError`.
- The built-in 0/24/71 fixtures retain exactly the same numeric longitudes,
  planet metadata, and visual geometry. This adds no new chart options or
  public library API.
- Synthetic fixtures are still **not scientifically calculated ephemerides**,
  real user charts, real artwork, nor evidence of image parity or mobile
  and Astrolabio compatibility.

## Validation

```sh
npm ci
npm run test:demo-fixtures
npm run verify:angular
```

The regression suite transpiles the actual TypeScript demo fixture module
and checks built-in fixture parity, negative and large positive wraparound,
all axis/planet/cusp longitude ranges, invalid input rejection and isolation
between generated themes. Browser screenshots (four modes, seven skins),
mobile PNG and Astrolabio headless/e-ink remain separate review gates.
