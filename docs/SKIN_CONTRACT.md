# Skin configuration contract (synthetic validation gate)

The renderer demo enumerates `Object.keys(SkinManager.skins)` directly. A missing
key, a nonfinite resonator dimension or opacity, or a broken image path can make
a particular chart mode/skin fail at runtime despite a successful TypeScript
build. This check protects the configuration surface without changing pixels.

## Run locally

From a full repository checkout with Node 22 and `npm ci`:

```bash
npm run test:skin-contract
npm run test:demo-pack
npm run verify:angular
```

The `test:skin-contract` command loads the **actual** TypeScript
`@skin-manager.ts` and `chart-asset-urls.ts` through TypeScript's transpiler,
then checks:

- The seven currently supported skin identifiers remain present.
- Four element colors and the natal/aspect, planet, zodiac, house, transit,
  synastry-override and latitude sections have required values. All configured
  palette colors use the currently supported CSS hex `#RGB` / `#RRGGBB`,
  `white` / `black` forms; the renderer-only `elementi` token is accepted
  **only** for zodiac-sign and house symbol colors, including their synastry
  overrides. Planet glyph tints are sent directly to Three.js and must be
  ordinary supported colors. New CSS color formats need explicit renderer
  compatibility review and a corresponding test update.
- The central resonator image is mandatory; dimensions/scale are finite and
  strictly positive, and opacity is finite in `[0, 1]`.
- Declared image/texture references resolve under the host-owned
  `/assets/img/` root and cannot silently switch to external URLs.
- Glyph image-folder selectors, when provided, use the available `bianco` and
  `nero` folders. Negative cases demonstrate the check catches missing artwork,
  unsafe/remote URLs, unsupported color tokens and folder names.
- Every active `texture` and `imgRisuonatoreSolare` declaration in
  `SkinManager` is a static string literal (or `null` for optional textures).
  Computed expressions are rejected, because the chart-only AST asset selector
  cannot guarantee those paths are represented in the synthetic demo manifest.

Optional textures, absent synastry overrides and **partial synastry overrides**
are permitted. The natal/transit base-ring colors remain required, while
`sinastria` properties are validated **when supplied**, because the renderer
uses `??` to fall back to base-ring colors and textures. For example, a
sinastry override may set only `coloreLinea` or only `coloreTexture`.
An invalid supplied color or a non-object override is rejected; an empty object
is allowed. This keeps the contract compatible with the renderer's fallback
behavior rather than requiring all override properties to be repeated.

When adding a new supported skin, update the expected IDs and confirm that
the demo offers it.

The existing `test:demo-pack` check also ensures the synthetic demo manifest includes
every active literal skin texture and resonator image discovered by the TypeScript
AST selection helper. This guards against a newly declared skin resource being
absent from local browser fixtures. It does not confirm that the original
host-owned asset exists or that a runtime-generated path resolves.

For a static declaration, the syntax gate protects **enumerability** only.
The separate `test:demo-pack` coverage check verifies that the declared
non-null resource paths appear in the generated synthetic manifest. Neither
check proves that private, real artwork has been approved or is present.

## Browser sinastria fallback probe

A separate browser regression in `tests/demo-browser.test.mjs` bundles
`tests/fixtures/synastry-skin-harness.ts`. It renders the same illustrative
natal/sinastria themes three times per scenario through the real renderer,
using the host-verified **synthetic** asset pack:

- `line`: the untextured `light` skin, changing only
  `anelloCase.sinastria.coloreLinea`.
- `texture`: the textured `astrolabio` skin, changing only
  `anelloCase.sinastria.coloreTexture` while retaining the existing
  synthetic gold texture.

For each scenario, the three PNGs represent the base ring (without a
sinastria override), a partial override, and a fully explicit equivalent
with all other values inherited from the base ring. The test asserts a
visible difference between the base and partial override and pixel-level
agreement between partial and explicit results (with a small WebGL
antialiasing tolerance). It restores the previous skin configuration even
if a render fails. The fixture preserves whether the original `sinastria`
property was present at all (rather than confusing an explicitly undefined
value with an absent property). A separate failure-path probe temporarily
rejects a synthetic asset request, asserts that the original skin object and
`GestoreImmagini.loadAsync` function are restored, disposes the failed
renderer, and verifies that a subsequent ordinary PNG export succeeds.
The asset-load rejection is intercepted inside the browser and does not
require editing the host's verified synthetic image pack.

The browser regression does not change the Angular demo, ship assets or
create approved screenshot baselines.

Run in a complete checkout after `npm ci` and `npm run demo:pack`. Keep
`npm run demo:assets` and `npm run demo` running in separate terminals,
then run:

```sh
npm run test:demo
CHART_TEST_BROWSER=firefox npm run test:demo
```

The second command uses POSIX environment syntax; on PowerShell set
`$env:CHART_TEST_BROWSER = 'firefox'` before `npm run test:demo`.
Configure the appropriate browser binaries as described in
[ANGULAR_DEMO.md](ANGULAR_DEMO.md). The new probe is part of the existing
browser suite; it is **not** part of `npm run verify:angular`. An isolated
JavaScript assertion pass is not evidence that this visual test passed.

This test is **not** a screenshot, a WebGL render, an asset-manifest integrity
check or a demonstration of visual parity with VirgoStars or Astrolabio.
Still run the Chromium/Firefox synthetic chart suite for all four modes,
verify rights and SHA-256 for any approved private assets, and separately
test mobile/headless/e-ink export before production integration. No GitHub
Actions, package publication or production deploy are involved.
