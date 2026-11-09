# Three-repository integration checkpoint — 2026-11-09

**Status:** `IMPLEMENTED_ISOLATED / NOT RELEASED`. This is the renderer repository's integration checklist and pointer to the central decision document in [astrological-assets](https://github.com/Cesare-ml/astrological-assets/blob/feat/approved-assets-import/docs/ECOSYSTEM_COORDINATION.md).

## System roles

- **Production host:** `Cesare-ml/virgo-stars`, `master`. Current normative code at `shared/grafici-astrologici/src` and artwork at `public/assets`. Site frontend and shipped Astrolabio remain unaffected.
- **Renderer code:** `Cesare-ml/astrological-charts`. Angular 20, TypeScript, Three.js, skins, module rendering, canonical URL resolution, tests and browser-dev asset server. **No real PNG/font files inside the package.**
- **Art:** `Cesare-ml/astrological-assets`, private. Metadata, approval gates and rights audit prepared; actual binary artwork is **not yet imported**. Includes [78 pending review records](https://github.com/Cesare-ml/astrological-assets/blob/feat/approved-assets-import/catalog/reviews/simboli-bianchi.pending.json) — 12 zodiac, 12 house, 50 celestial body and four element images.

**Important:** having access to the renderer repository is insufficient for a visually identical chart. A contributor must be able to access the approved asset pack, or use intentionally separate synthetic assets for limited functional testing. The collaborator must not require access to the private VirgoStars monorepo.

## Planned contributor setup (once asset binaries are approved)

```powershell
git clone https://github.com/Cesare-ml/astrological-charts.git
git clone https://github.com/Cesare-ml/astrological-assets.git

# Branches reflect current draft work, not released/main functionality.
cd astrological-charts
git switch feat/independent-assets-dev
npm install
npm run test:assets
node scripts/serve-local-assets.mjs --root ../astrological-assets/public/assets --manifest ../astrological-assets/manifests/approved-assets.json
```

The [Angular demo](ANGULAR_DEMO.md) configures the asset base and renders generated natal/transit/synastry/latitude fixtures. The real asset pack remains pending; synthetic success does not verify the original visuals.

## Current integration order

```text
astrological-charts #1 -> #8 -> #9 -> #10 -> #11     (stacked draft PRs)
             |
             +----> independent synthetic Angular demo (candidate; real visuals unverified)
                          |
astrological-assets #1 --+----> reviewed asset subset (not done)
                          |
                          +----> VirgoStars staging build (not done)
                                       |
                                       +----> production gated release (not done)
                                       |
                                       +----> Astrolabio gated offline release (not done)
```

The upstream has a separate **documentation-only** [VirgoStars PR #155](https://github.com/Cesare-ml/virgo-stars/pull/155) describing the cutover without modifying current runtime.

## Release invariants

1. **File ownership:** binaries stay out of this library npm package. After cutover, the asset pack owns the curated images; VirgoStars retains unrelated website graphics. No duplicate Angular `public/assets/img` source or output.
2. **URL stability:** browser HTML/CSS and `THREE.TextureLoader` must request the same canonical URLs, `/assets/img/...`, preserving names and case. CDN/CORS changes require separate verification.
3. **Renderer fidelity:** preserve geometry/skin behavior; compare baseline screenshots (7 skins, natal, transits, synastry, latitudes) and export PNG behavior.
4. **Hardware safety:** local e-ink rendering, `file://` compatibility, device image subset, version pins and rollback are mandatory before updating sold Astrolabio units.
5. **Rights:** stock textures, font files, branded Risuonatore Solare images and the symbols require owner confirmation before any external distribution, even through a private repository.
6. **Permissions:** for guaranteed read-only collaborator access to the asset repository, use GitHub organization roles. Personal-account private collaborator invites may permit writing.
7. **Deployment:** no GitHub Actions, no automatic merges, no AWS production changes, no public licences or publication without explicit owner approval.

## Pending technical blockers

- The top-of-stack candidate compiled after `npm ci` on Windows (Node 22.18.0); rendering with original assets remains unverified. Earlier PR heads need their own checks.
- A source mismatch exists: `risuonatore-solare-bianco.png` referenced by `dark-bn`/`light-bn` is not in the inspected assets tree; `risuonatore-solare-bn.png` exists. Do not automatically rename.
- `astrological-assets` has not received legally approved PNG/fonts or a verified complete manifest.
- Asset selection based on static references is conservative and can miss some dynamic filenames.
- Browser cache and GPU texture lifecycle are different concerns.
- The intended single-copy web build must be validated with the [asset collision guard](https://github.com/Cesare-ml/astrological-assets/blob/feat/approved-assets-import/scripts/check-web-asset-collisions.mjs) before cutover.

## Where to read next

- [Asset ecosystem contract](https://github.com/Cesare-ml/astrological-assets/blob/feat/approved-assets-import/docs/ECOSYSTEM_COORDINATION.md)
- [Migration plan](https://github.com/Cesare-ml/astrological-assets/blob/feat/approved-assets-import/docs/MIGRATION_PLAN.md)
- [VirgoStars normative graphics overview](https://github.com/Cesare-ml/virgo-stars/blob/master/docs/graphics/README.md)
- [Upstream documentation PR](https://github.com/Cesare-ml/virgo-stars/pull/155)

No script or documentation here has activated a production change.

## Local verification update

On 2026-11-09 the top of PR #13, including its extraction-check correction and lockfile, passed `npm ci`, `npm run preflight` and `npm run build` on Windows/Node 22.18.0. The asset-server tests required access to loopback; they initially failed inside the restricted sandbox and passed with loopback enabled. Inspection of the library `dist` found no PNG, JPEG, WebP, TTF or WOFF files. This does not verify a future VirgoStars build or rendering fidelity.

The active upstream `dark-bn` and `light-bn` skins reference `risuonatore-solare-bianco.png`; the local upstream tree contains `risuonatore-solare-bn.png` instead. The latter is a monochrome resonator image, but its intended equivalence cannot be established from the filename or appearance alone; no alias or rename is authorized by this observation.

## New candidate gate — self-contained synthetic preview

The [local asset preview](LOCAL_ASSET_PREVIEW.md) provides a real `/__preview` gallery served from a **manifest-verified, approved-only allowlist** of locally generated PNG placeholders. `scripts/preview-synthetic.ps1` can start it on Windows without `virgo-stars` or copying production artwork. The manifest validator rejects missing rights metadata, hashes or file paths. **This is an asset smoke test, not an Angular chart demo and not an Astrolabio test.** No real PNGs have been transferred yet.
