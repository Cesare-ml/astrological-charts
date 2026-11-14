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
