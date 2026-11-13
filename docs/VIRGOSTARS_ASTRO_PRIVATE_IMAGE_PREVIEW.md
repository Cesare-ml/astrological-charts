# VirgoStars Astro — opt-in private image preview in real charts

**Status: experimental renderer integration. Default OFF. No font or image binaries are committed.**

The VirgoStars owner approved two new image sheets (12 zodiac signs and 10 bodies), from which a private `VirgoStars Astro v0.2` pack was built. The approved **512x512 RGBA image silhouettes** are the source of truth. This PR adds a reversible means of testing those images in natal/transit/synastry chart layouts without replacing the existing skin assets.

## Why white-alpha masks, not the raw black PNGs?

The chart renderer currently uses a Three.js `MeshBasicMaterial` and multiplies the texture RGB by the skin's `color`. The approved v0.2 images are **black**, so feeding them directly into that shader would yield black planets/signs even on dark themes.

The private **v0.3 staging pack** contains 22 `png/*.png` images transformed into **white RGB (255,255,255) while preserving the original alpha channel byte-for-byte**. Changing RGB to white does **not** change the approved glyph silhouette. As a result, the skin color can tint the image correctly.

The renderer maps only the 22 canonical legacy references **when the drawing slot explicitly opts in** to:
`/assets/img/virgostars-astro/masks/<glyph-id>.png`

The name must be one of `aries` through `pisces`, or `sun`, `moon`, `mercury`, `venus`, `mars`, `jupiter`, `saturn`, `uranus`, `neptune`, `pluto`. All paths are lowercase and must remain exact.

## Locally staging the **private** masks

The local asset server now accepts **two separately verified manifests** without copying the artwork into the public charts repository. The original asset pack uses its existing strict `approved-assets.json` schema. The 22 private masks use their separately generated v0.3 `manifest.json` schema, plus a **separate explicit local-only owner authorization record**. Neither replaces or weakens the other.

1. Obtain the owner-approved private `VirgoStarsAstro-Private-Chart-Masks-v0.3.zip` or v0.3.1 package. Extract it to a **private location outside both Git checkouts**. Keep its existing `public/assets/` and `manifest.json` relative layout.
2. Make sure your independently reviewed `astrological-assets/public/assets` directory and its `manifests/approved-assets.json` are available. The server validates every original asset file via SHA-256.
3. Create `private-astro-approval.json` **outside the Git repository**. It must be an explicit owner-approved record, restricted to local preview, for example:

```json
{
  "scope": "local-preview-only",
  "rightsHolder": "VirgoStars",
  "permissionBasis": "Owner-authorized private testing of newly generated glyph images only",
  "approvalEvidence": "Owner's explicit instruction to use the approved generated images, 2026-11-12"
}
```

This attestation is for **local testing only**; it grants no open-source license, font redistribution permission or production deployment. If the owner cannot verify these facts, do not create the approval file or enable the overlay.

4. Start the existing loopback server with the two independent sets of inputs:

```bash
node scripts/serve-local-assets.mjs \
  --root ../astrological-assets/public/assets \
  --manifest ../astrological-assets/manifests/approved-assets.json \
  --astro-overlay-root ../private-astro-masks/public/assets \
  --astro-overlay-manifest ../private-astro-masks/manifest.json \
  --astro-overlay-approval ../private-astro-masks/private-astro-approval.json
```

The `private-astro-masks` folder name is illustrative. Use the actual private location. The server rejects incomplete overlays, non-local origins, unauthorized uses, wrong hashes, missing/duplicate/incorrectly named masks, wrong PNG dimensions, symlinks and any filename overlap with the original approved assets. **It also decodes the actual RGBA pixels**, rejects all nonwhite RGB **including pixels with zero alpha** (to avoid texture-filtering halos), and rejects any alpha coverage count that differs from the private manifest, even if someone refreshes the PNG's hash. PNG chunk CRCs, a 2 MiB size limit and a 64-chunk limit prevent corrupted or oversized input from being accepted. These controls protect light/dark tinting in Three.js; they do not establish chart rendering quality or font licensing.

**HTTP integrity statuses:** The local server selects from the approved manifests **before** attempting to resolve the file on disk. A previously approved base asset or private VirgoStars mask that is subsequently deleted, replaced with a symlink, or becomes inaccessible because a root directory disappears returns **HTTP 409** instead of a misleading 404 or an unhandled exception. A URL that was never in either manifest remains **HTTP 404**, including encoded aliases. No fallback across manifests is permitted. The dedicated `npm run test:astro-http-routing` suite covers these cases using only Node builtins; the existing `test:astro-overlay` suite additionally checks real localhost HTTP behavior with synthetic images.

5. Run the Angular demo (if installed): `npm run demo`. Enable **“Preview VirgoStars Astro glyph images”** or append `?astroGlyphs=1` to the demo URL. The preview starts **off** by default and requires the verified mask overlay when enabled.
6. Test natal/transit/synastry, light/dark and exported PNG. Include pointer/aspect focus checks after merging the separate interaction feature branch. Turn the preview off to restore original image references without changing production.

**Only the local server may read these masks**; it serves them on `127.0.0.1` under the same restricted origin policy as the base pack, and checks each requested file's SHA-256 again before returning it. The private overlay is never copied to the public charts repository.

The opt-in flag is also accessible to an authorized host:

```ts
import { GestoreImmagini } from 'grafici-astrologici';

// Configure BEFORE the renderer begins loading textures.
// The host must already serve the privately reviewed masks.
GestoreImmagini.configureVirgoStarsAstroPreview(true);

// Restore all original paths and visual dimensions:
GestoreImmagini.configureVirgoStarsAstroPreview(false);
```

## Exact replacement scope and fallback

| Reference kind | Behavior when enabled |
| --- | --- |
| The 12 **primary zodiac ring** slots (`simboli-bianchi/segni/01.png` … `12.png`) | Replaced with `virgostars-astro/masks/aries.png` … `pisces.png` |
| The 10 **primary celestial ring** slots (`simboli-bianchi/elementi-celesti/Sun.png` … `Pluto.png`) | Replaced with matching lowercase mask |
| `*-r.png` retrograde glyphs | **Not** replaced; original raster stays in use |
| AS/DS/MC/IC axes, asteroids, houses, fixed stars, lunar nodes, decans, decadi and dodecatemoria | **Not** replaced, even when using the same legacy PNG reference |
| Skin-specific images and latitude-specific assets | **Not** replaced in this initial integration |
| Preview disabled | **No change** to existing paths or sizes |

The new glyph masks have a square 512x512 canvas. The renderer uses a **square mesh for only explicitly opted-in main-ring images** to avoid distorting them into old 100x69 / 875x605 image aspect ratios. Original mesh sizes stay unchanged whenever the preview flag is off.

**Asynchronous preview safety:** A preview switch may change while Three.js is still fetching a texture. `OggettiSempliciRender.getImg` now snapshots the image-format decision **before** awaiting the material/texture load. The geometry therefore remains consistent with the URL selected at the beginning of that request; it cannot suddenly become square for a pending legacy image (or stretched for a pending private mask). `tests/astro-preview-geometry-race.test.mjs` exercises the actual renderer method with deferred texture promises for both toggle directions and for a non-opted-in drawing slot. The corresponding source-level asynchronous harness was **executed directly against the committed method, 3/3 PASS**. The full Node unit file and Angular browser runs have **not** yet been executed in an installed repository checkout.

**Angular demo lifecycle and PNG export concurrency safety (2026-11-13):** `ngOnDestroy` invalidates pending draw **and export** requests, marks the demo destroyed, disables its static private-preview opt-in and disposes the Three.js renderer. An outdated chart draw, mask-failure recovery or PNG export cannot report status, start a fallback, trigger a late download or update a destroyed component. A **new drawing also invalidates any older pending PNG export**; duplicate export calls while the UI is busy are ignored; the PNG filename and chart options are captured at the beginning of an export to avoid mode/skin mismatch. Success, errors and busy-state cleanup are accepted only for the current export and draw generation. The committed `tests/astro-demo-lifecycle.test.mjs` extracts and exercises the actual `ngOnDestroy`, `draw`, `drawWithPreviewRecovery`, `exportPng` and `showError` TypeScript methods with deferred fake rendering/export promises and now covers **12 cases**. **Actually executed against the current GitHub method bodies in an isolated dynamic harness: 12/12 PASS**, including cross-render export cancellation, duplicate export suppression, error races and filename stability. This is not the same as running full `npm run test:astro-demo-lifecycle` or Playwright; full Angular/build/export browser tests remain **not executed** in an installed checkout.

**Missing-mask recovery in the development demo:** if an authorized preview is requested but a VirgoStars Astro mask URL fails to load, the demo now **automatically unchecks the preview**, disables the private substitution and redraws the original chart. It displays the visible message `VirgoStars Astro masks were unavailable; the original symbols have been restored.` (not a silent fallback). The same behavior applies to an initial `?astroGlyphs=1` visit, toggling the checkbox, switching chart modes/skins or changing the asset base. The recovery is intentionally **restricted to errors containing `virgostars-astro/masks/`**: unrelated asset failures are never hidden. If the legacy redraw also fails, its actual error remains visible rather than falsely claiming a successful recovery. A newer draw request suppresses a stale recovery attempt. **The legacy-success notice is now only displayed when that exact fallback request has completed a new successful render**: the demo checks the fallback request ID, the advancing render-revision counter, preview still OFF and the absence of an error. An already-cancelled fallback that returns normally, or a different chart that succeeds meanwhile, can no longer produce a false restoration notice.

`npm run test:astro-preview-recovery` executes the actual TypeScript demo recovery method with a fake renderer, covering five outcomes and the UI wiring. The actual recovery method was **re-executed in an isolated JavaScript harness against its current GitHub source: 7/7 scenarios PASS**, including two new asynchronous regressions for a cancelled fallback and a competing successful render. The committed Node suite now contains **8 test groups** (including its source-contract test); the full Node file and real browser path have **not** yet been executed in the installed Angular checkout. The optional Playwright test now contains a second, separate case that intentionally aborts one mask at startup and checks that the original chart returns with preview OFF and a visible notice.

The preview toggle is **global/static** because `GestoreImmagini` is already static; it should not be mutated during an active render. Future per-renderer configuration must avoid the broader global-state concurrency limitation.

## Local verification — HTTP verified, Angular/browser pending

```bash
npm ci
npm run test:astro-preview
npm run test:astro-preview-scope
npm run test:astro-png
npm run test:astro-http-routing
npm run test:astro-http
npm run test:astro-preview-recovery
npm run test:astro-demo-lifecycle
npm run test:astro-geometry-race
npm run test:astro-url-integration
npm run test:astro-render-guard
npm run test:astro-overlay
npm run check:types
npm run build:demo
```

### Real HTTP integration results (2026-11-13)

**Actually executed on Node 22.16.0:** `node --test tests/astro-local-http.test.mjs` — **1/1 integrated test PASS**. It starts the actual `createAssetServer` on `127.0.0.1` with a synthetic approved SVG and 22 synthetic 512×512 white RGBA masks, and uses real HTTP requests to test GET, HEAD, approved CORS, unapproved Origin (403), unsupported method (405), OPTIONS (204), never-approved paths (404), SHA integrity, post-start tampering (409), removal (409), and root disappearance (409). **No private owner artwork is required or used by this public CI-safe test.** It is included in normal `test:assets` via `npm run test:astro-http`.

**Actual private v0.3.1 overlay verification:** the same exact committed local server and validators were run on loopback with the approved **22/22 private glyph masks** temporarily extracted outside the repository. All 22 mask GETs returned HTTP 200 and matched their recorded SHA-256; **6/6 additional HTTP checks passed** (synthetic base asset GET, private HEAD, unapproved path 404, forbidden external Origin 403, POST 405, OPTIONS 204). The temporary extraction was deleted and no private files were committed or modified. For repeatability, the new **opt-in** script performs the same read-only check using the owner's own approved pack:

```bash
npm run verify:astro-private-http -- \
  --overlay-root ../private-astro-masks/public/assets \
  --overlay-manifest ../private-astro-masks/manifest.json \
  --overlay-approval ../private-astro-masks/private-astro-approval.json
```

On Windows PowerShell, use the same arguments on one line after `npm run verify:astro-private-http --`. The folder name is illustrative: point at the **privately extracted pack outside the public Git checkouts**. The script requires all three paths and valid preview-only authorization; it does not enable public redistribution, touch the user's files or publish anything.

**Source integrity:** the locally executed integration-test source and the local server's four runtime modules were compared using Git blob SHA-1 and **match the committed GitHub versions byte for byte**. These checks validate asset serving and integrity, **not** the Angular/Three.js chart drawing, browser PNG exports, or pointer interactions. Those remain mandatory before merging.

**Local route regression (2026-11-13):** The actual committed server selection logic was executed in an isolated JavaScript harness across **10 positive and negative cases (10/10 PASS)**, covering both approved roots, removal of approved files, root-resolution failures, never-approved mask paths, encoded aliases and missing `/assets/` prefixes. In addition, the **exact committed** `tests/astro-local-routing.test.mjs` file (Git blob `9c89d9483514183e63cd69c3b12f4ec2781dcd64`) was run with Node 22.16.0 in an isolated temporary fixture containing that server route block: **4/4 Node test groups PASS**. These exercise real committed route-selection logic but are **not** a full localhost HTTP server integration suite. The regression remains wired into `test:assets`.

**Dependency-free Node PNG decoder regression (2026-11-13):** `npm run test:astro-png` runs `tests/astro-png-decoder.test.mjs` using only built-in Node libraries. It constructs generated 512×512 RGBA PNG fixtures and covers **all five PNG row filters (0–4)**, hidden black RGB under zero alpha, CRC tampering, alpha coverage mismatch, invalid filter bytes, interlacing, excessive PNG chunks, truncated/trailing data, true bounded-DEFLATE output overflow, and the 2 MiB file cap. **ACTUALLY EXECUTED with Node 22.16.0: 13/13 PASS.** The local test file Git blob was verified to match the committed file exactly (`d4bae9053589e84114df06d8f1088af8580c2282`); the verified validator file also matches its Git blob (`bd1d419570ea48a44f67d5c0bf641c156954c2ee`). Using the same validator, the 22 owner-approved private v0.3.1 mask images were rechecked in memory: **22/22 SHA-256 and decoded-alpha checks PASS**. The private binary assets remain outside Git. These are genuine standalone Node tests, **not** a full Angular test or real browser rendering pass.

**Focused local verification (2026-11-12):** the exact newly committed `scripts/png-mask-pixels.mjs` (Git blob `bd1d419570ea48a44f67d5c0bf641c156954c2ee`) was executed with Node 22 against all **22 approved private v0.3.1 PNG masks** and **eight negative cases** (CRC, mismatched coverage, truncated file, trailing bytes, oversize input, invalid coverage and invisible black RGB). **30/30 checks passed**. This is a standalone pixel-validator run, not the complete Node/Angular or browser suite.

The mapping tests exercise the actual TypeScript image-ref helper without loading any proprietary artwork. The separate overlay tests construct synthetic 512x512 PNGs to verify manifest integrity, permission gating, symlink/collision rejection and both positive and negative localhost HTTP requests. The private v0.3 ZIP itself was also verified locally against the new overlay validator (22 masks; 9 positive/negative checks passed).

## Dedicated browser integration test (requires authorized private mask staging)

The standard `npm run test:assets` automatically checks the mapping, exact renderer-slot scope and private-overlay security using **synthetic** assets only. It requires no access to the owner's images.

A separate **end-to-end browser test** was also added. Run it only after the two-manifest asset server and Angular demo have been started exactly as shown above:

```bash
CHART_ASTRO_TEST_PRIVATE_ASSETS=1 npm run test:astro-preview-browser
```

PowerShell equivalent:

```powershell
$env:CHART_ASTRO_TEST_PRIVATE_ASSETS = "1"
npm run test:astro-preview-browser
```

This uses local Chromium/Chrome, verifies **preview OFF by default**, observes all 12 zodiac mask requests plus at least one planet, checks light/dark and natal/transit/synastry rendering, tests PNG download **in memory**, then disables the preview and checks that the original chart appearance is restored. The Angular demo exposes a **monotonic `data-render-revision` counter** on its status element, incremented **only after a successful latest-request draw**. Canceled/stale asynchronous draws cannot claim completion, report obsolete errors or re-enable controls prematurely. The Playwright test waits for the counter to advance for every skin, chart-mode and preview-toggle operation, preventing a stale `Rendered` message from the preceding frame from producing a false positive. It also downloads three 1600×1600 PNGs **entirely in memory** for the same natal/light chart: original symbols, approved-image preview, and original symbols again after rollback. It must observe an exported pixel change when the preview is on and restoration within a 1% per-channel tolerance when the preview is switched off. This contract is regression-tested by `npm run test:astro-preview-scope`. No screenshots or private data are uploaded. Install the browser or set `CHROME_PATH` if needed.

**Focused dynamic verification:** the current `DemoComponent.draw()` method from the GitHub branch was extracted (TypeScript return annotation removed for execution), executed in an isolated fake-renderer harness, and passed **3/3 asynchronous scenarios**: stale success, stale failure, current failure. The committed `tests/astro-demo-render-revision.test.mjs` formalizes these same scenarios using TypeScript transpilation and is included in the normal asset preflight. The full repository Node suite was **not** run. Separately, 13 static source checks on the updated demo, browser test and scope regression passed; the browser test source passed a JavaScript syntax check.

**Image-manager integration regression:** `npm run test:astro-url-integration` compiles the committed TypeScript URL resolver, glyph allowlist and `GestoreImmagini` class into an isolated Node test without Angular or Three.js runtime. It verifies that all **22** permitted main-ring image paths require **both** the explicit drawing-slot flag and the global preview switch, that retrogrades/axes/secondary assets retain legacy URLs, and that toggling the preview off restores legacy paths without a fresh renderer instance. This test is added to `test:assets`. It does **not** load private images or verify a live WebGL drawing.

**Browser revision parser correction:** the `renderedRevision()` regular expression now matches decimal digits instead of a literal backslash-`d`. A separate numeric/nonnumeric regression case in `test:astro-preview-scope` checks the actual literal used by the browser test. **10/10 focused parser inputs passed** in an isolated check against the GitHub source; full browser execution remains pending.

**This browser test is written but has NOT yet been executed against an Angular demo with the owner's real private asset pack.** Its result must not be reported as PASS until run.

**Not completed by this PR:** real browser rendering using the now-supported separate private overlay, visual snapshots at chart scale, Chromium/Firefox PNG-export tests, any actual natal/transit interaction regression, licensing/public release, integration with VirgoStars website/Desktop, or Astrolabio device tests. Those require a locally staged, authorized private asset root and full runnable checkout.

Original source: [Astrological Assets font project issue #8](https://github.com/Cesare-ml/astrological-assets/issues/8). The rights of old raster files are tracked independently in [issue #2](https://github.com/Cesare-ml/astrological-assets/issues/2). No old Astro-SemiBold binary/outline is used here.
