# Render-only glyph layout: own-name boundary

The pure `layoutChartGlyphLongitudes` helper is part of the **draft**
planet interactions implementation (parent PR #22). It receives a mapping
of celestial-body names to precomputed coordinates. The renderer does **not**
calculate ephemerides or aspects.

## Problem and change

Two JavaScript object behaviors can create wrong render-only identity maps:

1. `for ... in` iterates inherited enumerable properties. For example,
   `Object.create({Ghost: {longitude: 45}})` should not produce a new planet
   in the ring when its only own key is `Sun`.
2. Assigning `result['__proto__'] = {...}` modifies a plain object's
   prototype instead of creating an own property. An untyped JSON payload
   can legally contain an own `"__proto__"` name; silently dropping it
   breaks one-to-one source/result identity.

The helper now enumerates **own** body names with `Object.keys` and
constructs a normal plain object with own data keys via
`Object.fromEntries`. This retains body names including `__proto__`,
`constructor` and `toString` without accidental prototype mutation.

For ordinary chart names the existing two-pass glyph separation, input
order, longitude arithmetic and appearance are unchanged. No public API
signatures are added. The original input object is not mutated.

## Test gate

```sh
npm run test:planet-layout
npm run verify:angular
```

The existing `test:planet-layout` command (already in `preflight`) now runs
both the parent suite and the new regressions. The new Node suite transpiles the **real** TypeScript helper using the
repository's `typescript` dependency; it checks inherited names,
own special keys, and ordinary input isolation. The parent PR's 200-case
legacy geometry suite remains mandatory for parity. Run Chromium/Firefox
synthetic visuals and the seven real-artwork skin baselines before merging
interactive rendering. These tests alone do not prove WebGL, mobile PNG or
Astrolabio/e-ink parity.

**Scope limitation:** this change protects only the pure layout result.
Callers must still validate incoming chart data and any other intermediate
object maps; it is not a general sanitation or prototype-pollution audit.
The parent PR is not merged into production.

## Collision-gap input guard

The legacy collision helper also accepted non-finite or negative custom
`minSeparation` values. `Infinity` could turn an otherwise finite
planet longitude into `NaN` during glyph separation; a negative gap
silently disabled separation. Both `relaxChartGlyphCycle` and
`layoutChartGlyphLongitudes` now reject gaps outside **0–360 degrees**
or any non-finite/nonnumeric value with `RangeError`.

Validation happens before sorting/mutating a working array, and before
building the output mapping. Valid numeric gaps, including the established
**7° default**, preserve the existing two-pass angular algorithm and
results. This validates the *visual layout parameter*, not upstream
astronomical longitudes or aspects.

The shared `test:planet-layout` command runs two extra regression cases:
invalid inputs must not mutate working coordinates, and permitted gaps
must reproduce the historical two-pass outputs. The special-key and
prototype-inheritance tests continue to apply unchanged.
