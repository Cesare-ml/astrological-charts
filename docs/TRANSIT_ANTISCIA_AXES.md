# Transit antiscia axes — fail closed on unknown option keys

## Problem

`TransitiRender.getAntisci` accepts an `opzioni.antisci` object whose
defined switches are `Cardinale`, `Fissa`, and `Mutevole`. The previous
implementation iterated every own key when drawing axis lines, and every
*enumerable inherited key* when drawing hovered planet-to-antiscion links.

A loaded options object with an unexpected truthy property could therefore
pass an undefined value from the supported-axis degree table into
`THREE.MathUtils.degToRad`. This can generate `NaN` transforms and
unnecessary geometry. The existing chart options default uses only the three
valid keys; the issue applies to malformed or forward-version option objects.

## Change

Both axis and hover-link loops now iterate only the existing local
`assi` table (`Cardinale`, `Fissa`, `Mutevole`). The renderer enables each
axis only when its switch is an **own property** of the supplied map;
inherited properties cannot silently activate axes. An omitted or null
`antisci` map is treated as empty, not as an exception.

- **Unchanged:** the existing 270°, 300°, and 330° antiscia axes, line
  colors, positions, circle geometry, hover behavior and cardinal order for
  valid options.
- **Changed:** unsupported own or inherited keys are ignored rather than
  passed to the geometry calculation.
- **Unchanged API:** method signature, return type, input option field names
  and host serialization remain the same.

## Synthetic tests

After `npm ci` run:

```bash
node --test tests/transit-antiscia-axes.test.mjs
npm run verify:angular
```

The test compiles the actual TypeScript class and uses synthetic Three.js
objects. It covers all three enabled axes at expected angles, an unexpected
own key plus an inherited key, unknown-only enabled flags, an unavailable
hovered planet, inherited *recognized* flags, and absent/null maps. It asserts finite geometry, object counts, and no invalid
arcs. No user birth data, approved image pack or production calls are needed.

**Visual review gates (not covered by these tests):** compare real browser
transit charts with each known axis enabled and multiple combinations,
include PNG exports, Firefox and Chromium, and separately validate the
Astrolabio headless/e-ink adapter before production integration.

## Compatibility and limitations

This is an input-hardening change to the transit antiscia drawing path;
it does not recalculate astronomical antiscia or change the option schema.
A downstream consumer that intentionally sent extra antiscia keys would
previously receive invalid, non-finite geometry; such keys no longer draw.
No package publish, licensing changes, source artwork, GitHub Actions or
production deployment are involved.

Draft PR review should check against the still-open large interactive
transit PR #22. Its current change to the same file is in
`getAnelloTransiti`, while this patch changes only the two loops of
`getAntisci`; retest after any future merge or rebase.

## Additional isolated regression evidence (2026-11-14)

- **PASS 7/7**: executed seven synthetic geometry cases in an isolated V8
  harness against the exact GitHub-readback TypeScript method body (minimal
  import/type syntax removal; source blob SHA `7f4412e4a5599377699b4d382bee121ddda8e2a8`).
  Cases include 3 valid axes, unexpected/inherited keys, unknown-only switches,
  missing hovered planets, inherited supported switches, undefined map and
  null map.
- **RED control 1/7**: the same seven cases against the original `main`
  source blob `171f1041b81ba188f21504deb326b6018967dd0a` failed six cases,
  including non-finite geometry and null/undefined errors.
- **NOT RUN**: the committed `node --test` suite, complete npm installation,
  Angular build, actual Chromium/Firefox/WebGL/PNG tests and Astrolabio device.
  These remain reviewer gates; the isolated harness does not replace them.

## Consolidation with marker contrast (2026-11-14)

This branch also includes the fix originally proposed in PR #82: the three
hover-marker circles now choose black or white from the selected skin's
existing background color using `getAntisciMarkerColor`. For the seven
shipped skins, light backgrounds use black and dark backgrounds use white;
valid antiscia geometry and positions remain unchanged.

Run **both** focused suites on the same checkout:

```bash
node --test tests/transit-antiscia-axes.test.mjs tests/antisci-marker-contrast.test.mjs
npm run verify:angular
```

Both tests are synthetic unit checks, not evidence of WebGL pixel parity.
Before merge, render transit antiscia hover on all seven skins in Chromium
and Firefox; verify that unknown own/inherited axis keys cannot generate
non-finite geometry and that PNG/mobile/headless consumers still behave.
No changes to `main`, automatic releases, or external asset packaging.

## Finite hovered longitudes

The hovered planet may be available by name while its `longitude` has not
yet been computed, or an upstream payload can contain `NaN`, `Infinity` or
a nonnumeric value. Before this additional hardening, those cases generated
three circles with non-finite rotations and their connecting lines. The
renderer now only draws the hover relation when the longitude is a finite
**number** (`Number.isFinite`), while retaining any valid enabled axis
lines; a valid zero-degree longitude still draws normally.

The focused axis suite covers non-finite/missing/nonnumeric input as well
as zero degrees. This guard is local to the antiscia hover visualization:
no ephemeris values are changed or converted and no fake coordinates are
created. Verify in-browser that removing the hover relation on invalid
planet data does not leave stale drawn objects after redraw.

## Lazy planet resolution during redraw (2026-11-14)

The transit antiscia renderer previously invoked
`ElementiCelestiRender.getElementiCelesti` unconditionally, even when no
hover relationship was requested. That function clones the planet input
and expects a complete theme payload. On redraws where only antiscia
axes are visible, these unnecessary computations could also fail on
yet-to-be-loaded planet data.

The renderer now collects only the **owned and enabled** supported axes
once and uses the same collection to draw axes and hover relations.
It resolves planet data **once**, and only when there is at least one
enabled known axis and a nonempty hovered planet name. Otherwise, axes
are drawn without accessing planet data. For normal valid hover input,
the same geometry and angular formulas are retained; the 0° longitude
path continues to produce three markers and four links per enabled axis.

Four new regressions assert no planet-data resolution with no hover,
with missing/disabled/unknown axes, and with empty hover names, plus
exactly one resolution when three axes have a valid hover.
An independent isolated V8 check of the current GitHub method returned
**24 PASS / 0 FAIL** (source blob
`e885d2170fdc9bc3154b6cdcee59ff6e54f33072`).
This check uses synthetic Three.js inputs; it is **not** a
benchmark, full TypeScript compile, Angular build or browser pixel test.
