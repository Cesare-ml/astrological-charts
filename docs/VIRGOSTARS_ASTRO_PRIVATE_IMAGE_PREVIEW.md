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

The preview toggle is **global/static** because `GestoreImmagini` is already static; it should not be mutated during an active render. Future per-renderer configuration must avoid the broader global-state concurrency limitation.

## Local verification / not yet validated

```bash
npm ci
npm run test:astro-preview
npm run test:astro-preview-scope
npm run test:astro-overlay
npm run check:types
npm run build:demo
```

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

This uses local Chromium/Chrome, verifies **preview OFF by default**, observes all 12 zodiac mask requests plus at least one planet, checks light/dark and natal/transit/synastry rendering, tests PNG download **in memory**, then disables the preview and checks that the original chart appearance is restored. It does not upload screenshots or private data. Install the browser or set `CHROME_PATH` if needed.

**This browser test is written but has NOT yet been executed against an Angular demo with the owner's real private asset pack.** Its result must not be reported as PASS until run.

**Not completed by this PR:** real browser rendering using the now-supported separate private overlay, visual snapshots at chart scale, Chromium/Firefox PNG-export tests, any actual natal/transit interaction regression, licensing/public release, integration with VirgoStars website/Desktop, or Astrolabio device tests. Those require a locally staged, authorized private asset root and full runnable checkout.

Original source: [Astrological Assets font project issue #8](https://github.com/Cesare-ml/astrological-assets/issues/8). The rights of old raster files are tracked independently in [issue #2](https://github.com/Cesare-ml/astrological-assets/issues/2). No old Astro-SemiBold binary/outline is used here.
