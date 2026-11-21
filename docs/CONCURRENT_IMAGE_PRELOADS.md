# Concurrent browser image preloading

## Problem and change

`GestoreImmagini.preloadImages(urls)` already canonicalizes and deduplicates URLs **within one call**, but two chart renders can request identical symbols at the same time. Previously each call allocated a separate `Image` instance and started a separate load.

The renderer now keeps a **temporary, in-flight-only** `Map<string, Promise<void>>` indexed by canonical asset URL. Simultaneous requests for the same URL share one Promise and one browser `Image`. Resolved and rejected entries are deleted, allowing later requests to reload and failures to retry. Map cleanup checks Promise identity before removal.

This does **not** retain completed images, cache GPU textures, deduplicate `THREE.TextureLoader` loads or guarantee any particular browser HTTP caching behavior. The existing per-call array order and `Promise<void[]>` result remain unchanged. Errors retain the existing rejected string message, and each caller receives the same rejection for a failed shared request.

## Offline test

On an installed checkout:

```bash
node --test tests/concurrent-image-preloads.test.mjs
```

The regression loads the real renderer TypeScript with the actual chart URL resolver through `typescript.transpileModule`. A deterministic `Image` substitute simulates completion, error, and an exception from assigning `src` without contacting production, loading artwork or starting WebGL. It checks:

- alias canonicalization and deduplication both within and across overlapping calls;
- eviction after a successful load and retry after a rejected load;
- independent in-flight entries when changing the configured asset base;
- recovery when an `Image.src` assignment throws synchronously;
- empty preload lists.

## Integration gate

Run `npm ci && npm run verify:angular` plus the existing Chromium/Firefox demo suites (synthetic pack and approved private assets where authorized) before merging. For the renderer memory-lifecycle gate (#5), also compare browser heap and `renderer.info.memory` during repeated redraws and PNG exports. Sharing in-flight browser `Image` objects should not be reported as proof of reduced WebGL memory use.

No change to chart geometry, skin texture paths, offscreen export, hardware, licenses, assets, GitHub Actions or production integration.
