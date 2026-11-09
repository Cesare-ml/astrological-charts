# Shared assets: one owner, many consumers

Decision for the private `astrological-charts` extraction. This is an architectural change in the **new repository only**; VirgoStars production is not modified.

## 1. Canonical source of truth

**Today:** `Cesare-ml/virgo-stars/public/assets/` stays the sole authoritative repository for the artwork actually used by the VirgoStars website.

- `astrological-charts` contains TypeScript code, an asset URL contract, documentation and test fixtures; **no duplicated production PNG/JPG/WebP or fonts**.
- The Angular website already includes `public/` in its assets build configuration. The library package must never configure an additional copy step for the same images.
- HTML/CSS components and the chart renderer use the same effective URLs: `/assets/img/simboli-bianchi/segni/01.png`, `/assets/img/simboli-bianchi/elementi-celesti/Sun.png`, etc.
- A browser can reuse HTTP cache entries for identical URLs when cache headers allow it. A shared URL does **not** automatically mean Three.js GPU textures are pooled: fixing that requires a lifecycle-aware texture cache separately.

```text
virgo-stars/public/assets  (single source of image files)
       |
       +---- Angular public assets copy (ONCE for this site build)
                         |
                         +---- VirgoStars HTML/CSS <img> + icons
                         |
                         +---- Astrological Charts / Three.js WebGL textures
```

The renderer package **must not ship a second copy** of the same assets.

## 2. New URL contract in this repo

`resolveChartAssetUrl(ref, publicAssetsBase = '/assets/')` canonicalizes the historical variants without changing every old renderer call:

| Original reference | Browser URL |
|---|---|
| `simboli-bianchi/segni/01.png` | `/assets/img/simboli-bianchi/segni/01.png` |
| `../../../assets/img/simboli-bianchi/segni/01.png` | same |
| `assets/img/simboli-bianchi/segni/01.png` | same |
| `/assets/img/simboli-bianchi/segni/01.png` | same |
| `assets/fonts/font.json` | `/assets/fonts/font.json` |

`GestoreImmagini` now normalizes references inside its texture loader and browser preload methods. It exposes:

```ts
// Optional: default is already /assets/ for VirgoStars
GestoreImmagini.configurePublicAssetsBase('/assets/');

// For local previews or a future CDN deployment, change only this root:
GestoreImmagini.configurePublicAssetsBase('https://static.example.org/assets/');
```

The pre-existing `assetsBase` raw prefix is kept as a **legacy override** for compatibility. For new consumers use `configurePublicAssetsBase`. The actual values above are examples, not deployed CDN addresses.

### Important delivery detail

Changing an image URL is not necessary to reuse it. In production, use exactly the same path in `<img>` tags and Three.js. If the host chooses a CDN later, the host frontend must configure both its HTML references and the renderer to share that CDN origin. For cross-origin WebGL textures the CDN must support CORS. Don't silently proxy unknown URLs or change cache headers in this extraction PR.

## 3. Independent contributors, no duplicate image repository

Contributors can clone the private renderer code without needing access to VirgoStars source assets.

A future private demo can use **explicit, safe sources**:

1. a read-only `/assets/` proxy for public files, with URL and CORS behavior documented;
2. intentionally minimal, licensed/synthetic local fixture images that are **not** production copies.

Never commit downloaded production artwork into this repo to make the preview work. Do not assume publicly accessible images can be redistributed under an open-source licence.

## 4. Offline Astrolabio

An offline physical device necessarily holds local files; it cannot share a disk with the deployed website.

- Keep only **one local copy per device/build** of the subset of assets needed by that device.
- Generate a versioned manifest from the canonical asset repository (path, SHA-256, size, logical group/skin).
- For device packaging, copy only the declared subset, diff manifests for updates, and pin renderer version + asset manifest version.
- Keep `file://` asset loading working. The existing Astrolabio runtime currently replaces `GestoreImmagini.getImg` and `loadAsync` with a `file://` adapter. Do not remove this compatibility until headless hardware tests pass.
- An image only used in a website page should not automatically enter the Astrolabio device build.

This is a planned packaging improvement; **not yet implemented or tested** on devices.

## 5. Validation gates

1. `npm run test:asset-urls` (pure URL contract) and `npm run check:extraction`.
2. After integrating in a controlled test site, check that an HTML image and the same WebGL symbol request the **same URL**; no duplicate emitted files in the website build.
3. Verify PNG export, all active skin configurations, mobile WebGL/headless flows and `file://` Astrolabio rendering.
4. Use browser network panel to verify HTTP cache behavior. Avoid claiming that duplicate GPU textures are eliminated by URL normalization alone.
5. Establish an asset rights inventory before any public repository release. Branded Risuonatore Solare artwork remains a distinct licensing decision.

## Out of scope

Moving `public/assets` into a new public repository; adding a second Angular asset copy; pulling the entire VirgoStars asset tree into the standalone package; changing the production build/deploy; rewriting the Angular renderer for another framework.
