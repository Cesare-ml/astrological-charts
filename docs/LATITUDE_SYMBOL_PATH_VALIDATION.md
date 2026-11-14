# Latitude symbol path validation

The latitude chart renderer selects image filenames using planetary keys from the supplied `TemaRender.planets` object. `latitudePlanetAsset(theme, name, transit)` now fails early for a malformed filename stem rather than constructing an unsafe or invalid host-owned asset URL.

- Accepts established planetary identifiers including spaces and dots (`true Node`, `mean Apogee`, `osc. Apogee`). The `true Node` to `true node` artwork alias is unchanged.
- Rejects empty, non-string, leading/trailing whitespace, `.` / `..`, path separators, percent-encoded inputs, query/fragment delimiters, colons and control bytes. This check is for **filename safety**, not an astronomical whitelist: unknown but syntactically safe planet names still resolve to candidate paths.
- Keeps the existing skin-to-artwork mappings, both circle and transit ring families, and returns the same URL path for valid names. The function does not touch the filesystem, fetch assets or bundle private artwork.

**Compatibility:** A malformed planetary key that formerly produced a broken/unsafe image path now throws `TypeError` during latitude chart rendering. Consumers should supply canonical body identifiers; do not silently rewrite keys or hide bad input. No natal/transit/synastry geometry, default skin behavior or public API shape is changed.

## Validation

```sh
node --test tests/latitude-asset-paths.test.mjs
npm run check:types
npm run verify:angular
```

The focused Node suite imports the **actual TypeScript helper** after `typescript.transpileModule` and checks every existing skin family, preserved aliases and malicious filenames. Only a clean Angular/browser run (including Chromium and Firefox, real approved asset pack and Astrolabio headless checks) can establish full renderer compatibility. The package is public but its license and redistribution rights remain unresolved; no production integration, npm publishing or GitHub Actions are part of this change.
