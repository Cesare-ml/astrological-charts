# Shared asset manifest — versioning and SHA-256 checksums

This feature complements the renderer's shared asset URL resolver
**without adding any copies of the original artwork**.
The currently authoritative production asset folder remains
`Cesare-ml/virgo-stars/public/assets/`, already used by the
Angular frontend and the chart renderer.

The manifest stores only **relative paths, file sizes, SHA-256
checksums and a deterministic fingerprint**. It contains no images,
fonts, personal birth records or astrological theme data. The
manifest does not constitute a legal or copyright review.

## Architecture

```text
virgo-stars/public/assets/  (production-owned artwork)
    |
    +-- Angular frontend -> /assets/img/... (one copy per build)
    |
    +-- asset-manifest.mjs -> metadata-only JSON manifest
                                    |
                                    +-- integrity checks
                                    +-- version-to-version comparison
                                    +-- future offline Astrolabio asset selection

astrological-charts/src/ -> canonical /assets/img/... URL resolver
                            (no artwork duplicated)
```

## Manual use

If you are an authorized developer with both repositories checked
out in sibling folders, run these **locally only** from
`astrological-charts`:

```sh
# Minimal example. Selection paths are relative to public/assets/.
node scripts/asset-manifest.mjs generate \
  --root ../virgo-stars/public/assets \
  --selection examples/chart-assets.selection.example.json \
  --out ./chart-assets-manifest.local.json

# Fail if any selected file is missing or changed.
node scripts/asset-manifest.mjs verify \
  --root ../virgo-stars/public/assets \
  --manifest ./chart-assets-manifest.local.json

# Compare two manifest versions: added, modified and removed paths.
node scripts/asset-manifest.mjs diff \
  --before ./chart-assets-manifest.previous.json \
  --after ./chart-assets-manifest.local.json
```

The `examples/chart-assets.selection.example.json` file is
**illustrative and incomplete**. A reviewed set for every skin must
be derived from live renderer and Angular component references.
Never assume that the example covers all real assets.

The generator **requires an explicit selection**. Scanning every
graphics or font file requires an explicit `--all yes` option.
This prevents accidentally including thousands of unrelated host
resources. The scanner considers only permitted file types under
`img/` and `fonts/`. Symbolic links, path traversal and
case-insensitive naming collisions are rejected.

Generate the manifest in a development workspace, inspect it and
use it to check availability before release. The browser does
**not** need the manifest merely to draw a chart, and the manifest
must not cause images to be bundled with the npm library.

Contributors who cannot access `virgo-stars` should use the
[generated synthetic demo](LOCAL_ASSET_PREVIEW.md), or an
approved private [astrological-assets pack](INDEPENDENT_ASSETS_REPOSITORY.md).
Do not use the production website as a hidden asset dependency.

## Future offline Astrolabio updates

Offline devices already hold the resources necessary to operate
without an Internet connection. A future versioned packaging
pipeline could, for each hardware build:

1. Select only the required subset from the canonical manifest.
2. Copy **one local copy per device** of each needed file, not the
   entire website asset directory.
3. Compare the installed manifest with the next release's manifest.
4. Transfer only new or changed files and verify SHA-256 before
   activation.

**This manifest generator does not copy, delete or update assets
on any Astrolabio device.** Incremental distribution and real-device
tests are not implemented.

## Test commands

```sh
npm run test:asset-manifest
npm run test:assets
```

Tests cover ordering determinism, SHA-256, explicit selection,
modified assets, duplicates, case-colliding names, path traversal
and symbolic links. Temporary synthetic fixtures do **not**
automatically prove that the whole real catalog or all seven
skins are complete.

## Limitations and security

- Do not add an `assets` declaration to `ng-package.json`.
- The Angular frontend must copy its `public/` folder **once**.
  It must not duplicate the same PNGs through an npm dependency.
- A manifest is not a content license. Artwork, including stock
  textures and Solar Resonator imagery, requires a separate
  rights and redistribution audit.
- Do not publish large inventories of unrelated private host files
  in the open-source renderer repository.
- Remaining work includes comprehensive skin-specific selection,
  verification against real assets, WebGL/network tests, and
  separately reviewed site and Astrolabio integrations.

## Automatic chart-only selection

Instead of maintaining `examples/chart-assets.selection.example.json`
by hand, `scripts/derive-chart-asset-selection.mjs` can derive
conservative candidate paths from active `SkinManager` and preload
references plus explicitly chart-related host directories. See
[Automated asset selection](ASSET_SELECTION_AUTOMATION.md).

The result is **not** a proven minimum for any shipped device;
unresolved literal references must block output and be investigated.
