# Latitude planet selection regression

`LatitudiniRender.getElementiCelesti` filters **precomputed** planet data; it does not calculate astronomical positions. Only enabled **own** entries of `opzioni.settaggi.elementi_celesti` and **own** records in `temaRender.planets` are considered; inherited planet data must not appear in the rendered result. A planet must exist in `temaRender.planets` and have a finite numeric `latitude`, including `0` and `-0`. The returned map preserves the original planet object references and does not mutate inputs.

The focused synthetic suite is `npm run test:latitude` (`node --test tests/latitude-zero.test.mjs`). It covers zero latitude, missing/disabled planets, nonnumeric values, finite boundaries, null-prototype maps, inherited option keys, and inherited planet records, null/undefined/malformed enablement entries, and missing selection settings (which must render no planets). The option guard uses optional chaining while preserving the previous truthy `att` contract. This suite extracts the real method body from its TypeScript source; it is **not** an Angular or WebGL integration test.

## Validation and release gates

At the 2026-11-15 edit, the GitHub connector confirmed commits, but a full checkout was unavailable because the execution container could not resolve `github.com` (`git clone` exit 128). Therefore the Node suite, `npm ci`, `npm run verify:angular`, Chromium/Firefox rendering, and checksums of actual approved image bytes are **NOT RUN**. The separate `Cesare-ml/astrological-assets/manifests/approved-assets.json` was readable and contains expected SHA-256 metadata; that alone is not a checksum verification.

Run the focused suite and Angular/browser checks in a clean Node 22 checkout before review. The change requires no new artwork, no astronomical computation, no public API change, and no deployment. Production VirgoStars and Astrolabio remain unchanged. Public redistribution/licensing rights remain unresolved.

## Incremental hardening (2026-11-15)

Missing `opzioni`, `settaggi`, or `elementi_celesti` now produces an empty selection rather than throwing. This is a fail-closed renderer guard: it does not infer astronomical data, enable planets implicitly, or change the public chart-input contract. A synthetic regression test covers each missing configuration layer. Full Node/Angular/WebGL validation remains required; do not infer runtime PASS from GitHub commits.

## Missing precomputed chart data (2026-11-15)

The selection method now returns an empty map when the chart itself or its `planets` map is missing, null or not an object. This is a defensive boundary for partially loaded chart inputs, **not** a replacement for validating precomputed astronomical data upstream. The tenth synthetic regression checks these malformed inputs and confirms a valid zero-latitude record still retains its original reference. No image, manifest, ephemeris algorithm, public API, or production consumer was changed. Runtime Node, Angular and WebGL verification remains **NOT RUN** until a complete checkout is available.

## Special own keys (2026-11-15)

An explicitly enabled own planet key named `__proto__` is now copied with `Object.defineProperty` instead of bracket assignment. This prevents a crafted precomputed map from changing the filtered result object's prototype while preserving normal enumerable own keys and input object identity. The eleventh synthetic regression checks the prototype, key visibility and original reference. This is defensive input handling, not astronomical calculation. Full Node, Angular, browser and real asset-byte SHA-256 checks remain NOT RUN; the separate approved manifest is metadata only until its bytes are hashed.

## Explicit enablement flags (2026-11-15)

An enabled planet must have its own `att` property on the option entry. A truthy `att` inherited through an option-entry prototype no longer enables a planet; an own `att: true` still works even if the prototype has `att: false`. The twelfth synthetic regression covers both cases with precomputed zero-latitude planets. This change does not alter ephemeris calculations, image assets, public exports, or production. Node/Angular/browser execution and approved asset-byte checksums remain NOT RUN until validated in a complete checkout.

## Explicit disablement precedence (2026-11-15)

The thirteenth synthetic regression checks an option with an **own** `att: false` shadowing inherited `att: true`, alongside a valid `att: true` shadowing inherited `att: false`. Only the explicitly enabled zero-latitude planet should be selected; the original option and planet references must remain unchanged. This adds test coverage only, without changing rendering geometry, asset references or astronomical calculations. GitHub commit acceptance does not constitute a Node test run; `node --test tests/latitude-zero.test.mjs` and Angular/browser validation remain **NOT RUN** in this environment.

## Own keys that shadow Object.prototype (2026-11-15)

The fourteenth focused regression covers explicitly enabled planet keys `constructor` and `toString` in null-prototype input maps. Both must survive as enumerable own data properties on the filtered result, retaining their original precomputed planet object references and the standard result prototype. This is a test-only addition; it does not introduce astronomical calculations, assets or public API changes. Full Node/Angular/WebGL validation and actual approved-asset SHA-256 verification remain NOT RUN.

## Non-enumerable selection entries (2026-11-15)

The fifteenth focused regression ensures a non-enumerable own option entry does not accidentally enable a precomputed planet. Symbol-keyed entries also remain outside the string-keyed selection contract. The test confirms that an enumerable zero-latitude planet is still selected by reference, and the input descriptor is unchanged. This is test-only; no astronomical calculations, rendering assets or public API were changed. Runtime execution of the Node suite, Angular builds, browser tests and actual image-byte SHA-256 verification remain **NOT RUN**.

## Legacy truthy flags (2026-11-15)

The sixteenth focused regression checks the existing truthiness contract for **own** `att` flags: numeric `1` and nonempty string `'yes'` enable valid precomputed zero-latitude planets, while `0` and `''` disable them. The test checks input reference identity and negative zero. This intentionally does not introduce strict Boolean-only validation, which would be a separate compatibility decision. No renderer source, asset, ephemeris or public API was changed. Node/Angular/browser execution and real approved asset SHA-256 checks remain NOT RUN because a full checkout is unavailable.
