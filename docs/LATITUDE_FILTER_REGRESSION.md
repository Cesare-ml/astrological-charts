# Latitude planet selection regression

`LatitudiniRender.getElementiCelesti` filters **precomputed** planet data; it does not calculate astronomical positions. Only enabled **own** entries of `opzioni.settaggi.elementi_celesti` and **own** records in `temaRender.planets` are considered; inherited planet data must not appear in the rendered result. A planet must exist in `temaRender.planets` and have a finite numeric `latitude`, including `0` and `-0`. The returned map preserves the original planet object references and does not mutate inputs.

The focused synthetic suite is `npm run test:latitude` (`node --test tests/latitude-zero.test.mjs`). It covers zero latitude, missing/disabled planets, nonnumeric values, finite boundaries, null-prototype maps, inherited option keys, and inherited planet records, null/undefined/malformed enablement entries, and missing selection settings (which must render no planets). The option guard uses optional chaining while preserving the previous truthy `att` contract. This suite extracts the real method body from its TypeScript source; it is **not** an Angular or WebGL integration test.

## Validation and release gates

At the 2026-11-15 edit, the GitHub connector confirmed commits, but a full checkout was unavailable because the execution container could not resolve `github.com` (`git clone` exit 128). Therefore the Node suite, `npm ci`, `npm run verify:angular`, Chromium/Firefox rendering, and checksums of actual approved image bytes are **NOT RUN**. The separate `Cesare-ml/astrological-assets/manifests/approved-assets.json` was readable and contains expected SHA-256 metadata; that alone is not a checksum verification.

Run the focused suite and Angular/browser checks in a clean Node 22 checkout before review. The change requires no new artwork, no astronomical computation, no public API change, and no deployment. Production VirgoStars and Astrolabio remain unchanged. Public redistribution/licensing rights remain unresolved.

## Incremental hardening (2026-11-15)

Missing `opzioni`, `settaggi`, or `elementi_celesti` now produces an empty selection rather than throwing. This is a fail-closed renderer guard: it does not infer astronomical data, enable planets implicitly, or change the public chart-input contract. A synthetic regression test covers each missing configuration layer. Full Node/Angular/WebGL validation remains required; do not infer runtime PASS from GitHub commits.
