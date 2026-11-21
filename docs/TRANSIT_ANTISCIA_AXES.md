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

## Hover during partial theme loading (2026-11-14)

`ElementiCelestiRender.getElementiCelesti` clones `temaRender.planets`
with `JSON.stringify`/`JSON.parse`. A hover can remain selected while
an asynchronous theme change is in progress, when `planets` is missing
or null. In that state, attempting the clone throws and previously prevented
even the independent antiscia axis lines from rendering.

The hover lookup is now attempted only when `temaRender.planets` is a
non-null object. An incomplete theme, including a null theme, skips only
the hover relation; enabled known axes still render. Once the planet map
is supplied, normal hover rendering resumes. No fallback coordinates or
artificial planets are created. The focused suites use a synthetic theme
with a planet map for normal-path checks and separately exercise missing,
null and undefined maps.

**Validation:** 29/29 isolated V8 checks using the GitHub-readback
`getAntisci` method and contrast helper (including all seven skins,
missing theme cases, zero longitude, invalid longitude, unknown axes and
lookup count). This is *not* an execution of the committed Node test files,
Angular typechecking, or browser WebGL regression. The updated branch
contains 13 axis cases and 3 marker contrast cases for future full-checkout
execution.

## Focused Node runner verification in isolated reconstruction (2026-11-14)

A temporary local workspace at `/tmp/astro-pr85-qa` on **Node
v22.16.0**, **npm 10.9.2** and TypeScript **5.8.3** executed:

```bash
node --test tests/transit-antiscia-axes.test.mjs tests/antisci-marker-contrast.test.mjs
```

**Exit 0; PASS 17/17, FAIL 0.** Both test files are byte-identical to
their actual GitHub PR #85 blobs (Git blob SHAs:
`b917d0c9b882a532b0400c197d1832caa2bb57d0` for 13 axis cases
and `a9de6d9631f3a18c7bedf56b6934b6e57eaa071a` for four color
cases). The color helper is also byte-identical (SHA
`dcffd954b6bd848e1dd24e098c940d310b9da2af`).

The renderer in the local fixture contains **the exact GitHub
`getAntisci` method**, independently compared for length and
FNV-1a checksum (3814 UTF-16 code units, checksum 2504128235),
but not the full original module; its other renderer methods are
excluded. The local `SkinManager` fixture contains only the seven
`bgColor` values (not the complete original palette/asset metadata).
Mocked Three.js objects and celestial input are supplied by the
committed tests. Therefore these are **actual Node test executions
with reconstructed inputs**, *not* a clean repository checkout or
full-production rendering acceptance.

Local `git ls-remote` still cannot resolve `github.com`, so
`npm ci`, `npm run verify:angular`, and real Chromium/Firefox,
PNG, and headless Astrolabio validations remain **NOT RUN**.
The results do not certify integration or art asset parity.

## Full transit renderer integration tests (2026-11-14)

Reconstructed the **complete** `src/lib/renderers/moduli/transiti.renderer.ts`
source in the temporary test workspace and verified its Git blob SHA-1 is
identical to the current PR file:
`622fc2fbec6cda35df21a5642c3a819caff6d8fa`.
This supersedes the earlier method-only reconstruction evidence.
The actual GitHub `antisci-marker-color.ts` and both committed test
files are likewise checked by Git blob hash.

The focused Node harness now exercises both public methods
`getAnelloTransiti` and `getAntisci` using synthetic Three.js primitives
and stubbed `getAnelloElementiCelesti`. Three new integration cases cover:

- `mostraAntisci: false`: the planet ring stays visible and no antiscia
  lookup occurs despite a stored hover selection.
- `mostraAntisci: true` with an incomplete theme: the planet ring and
  valid antiscia axes render independently of missing planet positions.
- `mostraAntisci: true` with valid zero-degree hovered data and three
  axes: 24 expected antiscia objects are created with one planet lookup.

Local command:

```bash
node --test tests/transit-antiscia-axes.test.mjs tests/antisci-marker-contrast.test.mjs
```

**PASS 20/20, exit 0, Node v22.16.0 and TypeScript 5.8.3.**
The combined suite now contains 16 axis/integration test definitions and
four contrast tests. The reconstructed workspace uses the exact full
transit renderer and current committed test files (SHA of the expanded
axis suite: `1f1985a1ed929e04b6144580c49a68cf08597308`).
It still replaces several imported dependencies, including most
`SkinManager` configuration, with minimal fixtures. This **does not**
establish a passing Angular typecheck/build, actual browser/WebGL
geometry parity, PNG export, or Astrolabio support. These gates remain
**NOT RUN** until a full checkout and approved local assets are available.

## Non-finite geometry inputs (2026-11-14)

The axis rotations depend on the reference ascendant and zodiac-ring
diameter; hover marker positions additionally depend on the inner ring
diameter. If any of these inputs is `NaN` or infinite, the original
renderer could emit non-finite rotations, line endpoints or positions.

The renderer now **returns an empty antiscia group** when either the
reference ascendant or zodiac-ring diameter is not a finite number.
For an invalid inner-ring diameter, it still draws finite axis lines
but **omits the hover circles and their connecting lines**. No fallback
coordinates are invented; ordinary finite values, including zero, use
the existing astronomical angle and geometry formulas.

The new tests check `NaN`, `Infinity`, `-Infinity`, and missing
values across those three inputs. The original PR renderer failed
**3/3** targeted red-control checks in a local Node test harness.
After the change, the two committed test suites completed with
**23/23 PASS, exit 0** on Node v22.16.0 / TypeScript 5.8.3 in the
temporary reconstructed workspace. The full `transiti.renderer.ts`
and modified axis test file were checked as **byte-identical** to
their GitHub PR blobs:
`2202562c35dfd584f756228edda903b5d6360ed3` and
`5027b7722b991c5d9d20cf28b9605f6c38831642`.

The 23 tests comprise 19 axis/integration cases and four marker
contrast cases. Three.js primitives, planet lookup and a minimal
seven-color `SkinManager` fixture remain synthetic. This
is **not** a full `npm ci`, Angular build, browser/WebGL
pixel comparison, PNG export, Astrolabio headless or release
signoff. Keep the PR draft until real consumer validation.

## Angle and periodicity regression gate (2026-11-14)

The synthetic axis suite previously checked geometry counts and finite
coordinates but did not assert the exact antiscion/contra-antiscion angle
or the 360° periodicity of planet longitudes. Two new regression tests
check the **actual `getAntisci` renderer method**:

- For a 10° planet longitude and the Cardinal 270° antiscia axis
  (`ascRef=90°`), the planet marker is at 10°, its antiscion at
  `2 × 270° - 10° = 530°` (170° mod 360), and the
  contra-antiscion at 710° (350° mod 360). Tests assert marker positions
  on the inner circle and that connecting lines reuse the correct
  endpoint objects.
- With all three axes enabled, the nine marker positions for
  longitudes `-45°, 0°, 10°, 180°, 359.999°, 720°` are equal,
  within a small floating-point tolerance, to the positions after a
  full 360° longitude shift.

In the same temporary local Node/TypeScript reconstruction, the command
`node --test tests/transit-antiscia-axes.test.mjs tests/antisci-marker-contrast.test.mjs`
returned **25 PASS / 0 FAIL, exit 0**. Both test suites and the entire
transit renderer were verified against their exact GitHub blobs:
`8ad7a2d3f425edd827810bff0aa3cb54fb9d2a78` (21 axis tests),
`a9de6d9631f3a18c7bedf56b6934b6e57eaa071a` (four
contrast tests), and `2202562c35dfd584f756228edda903b5d6360ed3`
(renderer). The real production Three.js and Angular dependency tree
are **not** loaded; synthetic stubs still supply scene primitives,
planet selection, and the seven skin backgrounds. Therefore
`npm run verify:angular`, actual browser/PNG visual checks and
Astrolabio integration remain **NOT RUN**.

## Avoid planet cloning for invalid inner-ring geometry (2026-11-14)

An earlier geometry guard prevented the creation of non-finite hover markers
when `diametroAnelloCase` is invalid, but the renderer still called
`ElementiCelestiRender.getElementiCelesti` *before* that check. That
helper JSON-clones the theme's planet data, performing work and possibly
throwing even though the hover relation would never be drawn.

The planet lookup now also requires
`Number.isFinite(diametroAnelloCase)`. Valid antiscia axis lines
continue to render independently, while a non-finite inner-ring diameter
prevents both the unused planet lookup and the hover geometry.
Finite diameters (including zero) keep their existing behavior.
No planetary calculation, chart contract, colors or assets were changed.

**Reproduction:** A new Node regression with
`failOnCelestial: true` and `NaN`, `Infinity`, `-Infinity` and
`undefined` inner-ring diameters failed against the previous renderer
with `Celestial computation must be skipped`. With the change applied,
the actual reconstructed local test command returned
**26/26 PASS, 0 FAIL, exit 0**, Node 22.16.0 and TypeScript 5.8.3:

```bash
node --test tests/transit-antiscia-axes.test.mjs tests/antisci-marker-contrast.test.mjs
```

The complete local transit renderer and the new axis test file were
byte-verified against GitHub PR #85 blob SHAs
`d7684b6bab1e08a2180ef72b29bbfdbacf89f1f6` and
`02ee56420173a7548a07bad378fbfd2816cc3cb5`.
The color helper is unchanged. TypeScript `transpileModule` reported
zero syntax/transpilation diagnostics for both affected TS files.
This does **not** constitute `tsc` typechecking or
`npm run verify:angular`; the Three.js and planet inputs remain mocked,
and real Chromium/Firefox/PNG/Astrolabio tests remain not run.
