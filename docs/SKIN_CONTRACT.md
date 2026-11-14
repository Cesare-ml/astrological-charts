# Skin configuration contract (synthetic validation gate)

The renderer demo enumerates `Object.keys(SkinManager.skins)` directly. A missing
key, a nonfinite resonator dimension or opacity, or a broken image path can make
a particular chart mode/skin fail at runtime despite a successful TypeScript
build. This check protects the configuration surface without changing pixels.

## Run locally

From a full repository checkout with Node 22 and `npm ci`:

```bash
npm run test:skin-contract
npm run verify:angular
```

The `test:skin-contract` command loads the **actual** TypeScript
`@skin-manager.ts` and `chart-asset-urls.ts` through TypeScript's transpiler,
then checks:

- The seven currently supported skin identifiers remain present.
- Four element colors and the natal/aspect, planet, zodiac, house, transit,
  synastry-override and latitude sections have required values.
- Resonator dimensions/scale are finite and strictly positive, and opacity is
  finite in `[0, 1]`.
- Declared image/texture references resolve under the host-owned
  `/assets/img/` root and cannot silently switch to external URLs.

Optional textures and null synastry overrides are permitted. When adding a
new supported skin, update the expected IDs and confirm that the demo offers it.

This test is **not** a screenshot, a WebGL render, an asset-manifest integrity
check or a demonstration of visual parity with VirgoStars or Astrolabio.
Still run the Chromium/Firefox synthetic chart suite for all four modes,
verify rights and SHA-256 for any approved private assets, and separately
test mobile/headless/e-ink export before production integration. No GitHub
Actions, package publication or production deploy are involved.
