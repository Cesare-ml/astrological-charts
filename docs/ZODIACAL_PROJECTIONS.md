# Natal zodiacal projections: Dodecatemori, Antisci and Contrantisci

**Status:** feature branch / review proposal only. The extracted library is **not** used in the
production website or deployed Astrolabio, and has not completed its license/asset-rights gate.
No assets, backend ephemerides, fonts or live chart data are copied into this repository.

## Scope and provenance

The source of truth for the current *website* feature is
[`virgo-stars` PR #213](https://github.com/Cesare-ml/virgo-stars/pull/213),
with the dodecatemoria groundwork from
[`virgo-stars` PR #206](https://github.com/Cesare-ml/virgo-stars/pull/206).
The three reflection-axis convention was compared with the owner's
`Cesare-ml/Regolo-Alpha-Leonis` repository
(`CartaAstraleRender.getAntisci`).
This code implements the geometry anew; it does not copy private assets or
private Regolo source.

The Angular/Three.js library receives **renderer options** rather than
embedding menu components. The bundled demo demonstrates one compatible host
UI: a single row with **Dodecatemori ×13 | Antisci | Contrantisci**,
followed by the selected option's planet glyphs and, for the two reflections,
an axis selector.

## Public input contract (additive)

`OpzioniGrafico.proiezioneZodiacale` is optional, so existing host options
remain valid. The default is inactive:

```ts
const options = structuredClone(defaultOpzioniGrafico);
options.proiezioneZodiacale = {
  tipo: 'antisci',          // 'antisci' | 'contrantisci' | undefined
  asse: 'Fissa',            // 'Cardinale' | 'Fissa' | 'Mutevole'
  pianeta: 'Sun'           // 'tutti' or one of seven traditional planets
};
```

For the dodecatemorion, use **existing** `dodecatemoriAttivi` and
`dodecatemore` options. Their target longitudes must exist in
`TemaRender.planets[planet].dodecatemoria.longitude`; the renderer does **not**
recalculate the ×13 position. The synthetic demo fixture contains illustrative
precomputed values only.

Hosts must make these three modes **mutually exclusive**. If an external
caller supplies both, dodecatemoria takes priority over antiscia in scene
composition. `tipo` absent disables the mirror layer. Selection of
`pianeta: 'tutti'` draws markers without any new aspect nodes.

## Mathematical convention

Normalise `λ` into `[0°, 360°)`. Regolo's three selectable axes are:

| Axis | Reflection reference | Geometric diameter |
| --- | ---: | --- |
| Cardinale | 270° | Cancer / Capricorn, 90°–270° |
| Fissa | 300° | Leo / Aquarius, 120°–300° |
| Mutevole | 330° | Virgo / Pisces, 150°–330° |

```text
antiscion(λ, axis) = (2 × axis − λ) mod 360
contra(λ, axis)    = (antiscion(λ, axis) + 180) mod 360
```

For example, at 10° Aries, Cardinale produces 170° / 350°,
Fissa 230° / 50°, and Mutevole 290° / 110°.

The pure implementation is `src/lib/renderers/moduli/zodiacal-projections.ts`;
it is exported from the existing package entrypoint as an **additive**
API, and shared by the renderer and synthetic tests.

## Visual semantics

**Dodecatemori:** selecting a single planet grays out natal planets and
radial lines, adds an anticlockwise arc from the natal longitude to the
precomputed dodecatemoria, shows a colored destination glyph that subtly
pulses, and preserves color only on aspects involving that dodecatemorion.
`Tutti` shows small filled planet-colored dots tangent to the inside of
the outer edge of the planet ring, **without arrows or derived aspects**.

**Antisci:** select an axis and a single planet to show the selected
diameter and **three solid, planet-colored segments** connecting the
natal position, antiscion and chart center. The destination glyph is
shown. `Tutti` uses filled dots with no per-planet segments or
derived aspects.

**Contrantisci:** select the same three possible axes and a single planet
to show the selected diameter and **one dashed red radial line**
(`#f60a09`) from chart center to contrantiscion. It does **not** draw
the antiscion triangle. `Tutti` uses hollow ring markers with no
per-planet lines or derived aspects.

For both reflections, natal aspects are neutral gray in focused mode.
No speculative aspects are added from projected points. Display coordinates
share the natal ascendant rotation, with the existing southern-hemisphere
inversion applied by the scene. All planet glyph textures remain host-owned
under the existing `/assets/img/` contract.

## Animation, export, consumers

The selected destination glyph is marked for the interactive
`GraficoRenderService` to pulse with a cancellable `requestAnimationFrame`.
A redraw or component destruction stops the loop, and
`prefers-reduced-motion` disables it. The PNG export and direct headless
`CartaAstraleCreaScena` output remain static (the metadata alone does not
animate). Scene construction and exports remain serialized by the existing
service. No new images are needed for markers.

The demo contains three same-row buttons and glyph-only planet choices with
black symbols, tooltip names and accessible labels. The UI is an *example*
for host applications, not a component bundled into the public renderer API.

## Manual validation gates

Run these **on a clean checkout** with Node 22.18+, npm and the exact lockfile:

```sh
npm ci
node --test tests/zodiacal-projections.test.mjs tests/zodiacal-render-contract.test.mjs
npm run verify:angular
npm run demo:pack
npm run demo:assets
# In another terminal: npm run demo
# With the demo and asset server active:
npm run test:demo
```

Repeat the browser tests with `CHART_TEST_BROWSER=firefox`. Inspect PNGs for
light/dark, 0°/360°, all three reflection axes and mobile controls. Verify
repeated selection/disable cycles, texture counts, missing-asset failure and
`prefers-reduced-motion`. The test suite also exercises the synthetic
offline/headless path; run `npm run test:offline` separately.

**Not done by this PR:** production import migration, host asset copying,
npm release, Cloudflare deployment, GitHub Actions, device updates, approval
of source/artwork rights, visual parity on all original skins or actual
Astrolabio hardware. Those remain maintainer-review gates.

Rollback: revert the feature branch/PR. This does not affect the live site.
