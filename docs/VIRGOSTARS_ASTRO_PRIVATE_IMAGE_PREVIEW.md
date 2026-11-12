# VirgoStars Astro — opt-in private image preview in real charts

**Status: experimental renderer integration. Default OFF. No font or image binaries are committed.**

The VirgoStars owner approved two new image sheets (12 zodiac signs and 10 bodies), from which a private `VirgoStars Astro v0.2` pack was built. The approved **512x512 RGBA image silhouettes** are the source of truth. This PR adds a reversible means of testing those images in natal/transit/synastry chart layouts without replacing the existing skin assets.

## Why white-alpha masks, not the raw black PNGs?

The chart renderer currently uses a Three.js `MeshBasicMaterial` and multiplies the texture RGB by the skin's `color`. The approved v0.2 images are **black**, so feeding them directly into that shader would yield black planets/signs even on dark themes.

The private **v0.3 staging pack** contains 22 `png/*.png` images transformed into **white RGB (255,255,255) while preserving the original alpha channel byte-for-byte**. Changing RGB to white does **not** change the approved glyph silhouette. As a result, the skin color can tint the image correctly.

The renderer maps only the 22 canonical legacy references to:
`/assets/img/virgostars-astro/masks/<glyph-id>.png`

The name must be one of `aries` through `pisces`, or `sun`, `moon`, `mercury`, `venus`, `mars`, `jupiter`, `saturn`, `uranus`, `neptune`, `pluto`. All paths are lowercase and must remain exact.

## Locally staging the **private** masks

1. Obtain the owner-approved **private** `VirgoStarsAstro-Private-Chart-Masks-v0.3.zip` package from the owner. Keep it outside any public repository.
2. Extract `public/assets/img/virgostars-astro/masks/` into a dedicated authorized **local development asset root**. Do **not** commit the images, add them to public npm output or publish them to a CDN.
3. The existing manifest-gated asset server must validate **all served assets**, including these 22 masks. An ordinary asset manifest containing only the original 1,013 images **cannot serve** these masks. Prepare an independently reviewed private staging manifest with all original assets and mask SHA-256s, preserving the host server's schema and private approval metadata. The mask pack's `manifest.json` records hashes, but is **not** by itself a complete server-compatible manifest.
4. Start the approved local asset server as described in [local asset preview](LOCAL_ASSET_PREVIEW.md), using the combined *private* staging root and manifest. The demo never needs access to a production backend.
5. Run the Angular demo (if locally installed): `npm run demo`, open the page and enable **“Preview VirgoStars Astro glyph images”**. Alternatively, append `?astroGlyphs=1` to the demo URL; the flag starts **off** by default.
6. Switch natal/transits/synastry, light/dark skin and PNG export. Check both the image silhouettes and the pointer/aspect interactions when used alongside the in-progress interaction PR. Turn off the preview to roll back immediately.

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
| `simboli-bianchi/segni/01.png` … `12.png` | Replaced with `virgostars-astro/masks/aries.png` … `pisces.png` |
| `simboli-bianchi/elementi-celesti/Sun.png` … `Pluto.png` | Replaced with matching lowercase mask |
| `*-r.png` retrograde glyphs | **Not** replaced; original raster stays in use |
| AS/DS/MC/IC axes, asteroids, houses, fixed stars, lunar nodes, decans | **Not** replaced |
| Skin-specific images and latitude-specific assets | **Not** replaced in this initial integration |
| Preview disabled | **No change** to existing paths or sizes |

The new glyph masks have a square 512x512 canvas. The renderer uses a **square mesh for only mapped images** to avoid distorting them into old 100x69 / 875x605 image aspect ratios. Original mesh sizes stay unchanged whenever the preview flag is off.

The preview toggle is **global/static** because `GestoreImmagini` is already static; it should not be mutated during an active render. Future per-renderer configuration must avoid the broader global-state concurrency limitation.

## Local verification / not yet validated

```bash
npm ci
npm run test:astro-preview
npm run check:types
npm run build:demo
```

The new unit tests exercise the actual TypeScript image-ref helper without loading any copyrighted artwork, fonts or Angular app. They cover all 22 names, legacy prefixes, retrograde preservation, unsupported symbols and malformed/hostile paths.

**Not completed by this PR:** real browser rendering against a combined private manifest, visual snapshots at chart scale, Chromium/Firefox PNG-export tests, any actual natal/transit interaction regression, licensing/public release, integration with VirgoStars website/Desktop, or Astrolabio device tests. Those require a locally staged, authorized private asset root and full runnable checkout.

Original source: [Astrological Assets font project issue #8](https://github.com/Cesare-ml/astrological-assets/issues/8). The rights of old raster files are tracked independently in [issue #2](https://github.com/Cesare-ml/astrological-assets/issues/2). No old Astro-SemiBold binary/outline is used here.
