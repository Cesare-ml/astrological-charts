# Independent chart asset preview — no VirgoStars production access needed

**Status:** The asset gallery and the separate Angular renderer demo are
integrated on `main`. Both have been exercised with synthetic fixtures
and privately authorized images, but **not** compared with approved
production visual baselines. This page explains the **asset gallery**;
the [Angular demo](ANGULAR_DEMO.md) uses the actual chart renderer
with illustrative, non-astronomical chart data.

The local asset server rejects manifest entries whose explicit
`status` is anything other than `approved`. The older import manifest
format, which does not have a `status` field, remains supported.
**Manifest checksums and metadata do not themselves prove legal
permission to redistribute artwork.**

## Why the independent asset server exists

A contributor may have access to `astrological-charts` but not to the
private VirgoStars application. The chart renderer requires textures
and symbol images for its actual appearance, so the code alone is
insufficient to reproduce the production visual design.

A separate, currently private repository,
`Cesare-ml/astrological-assets`, stores owner-authorized chart image
files and a SHA-256 manifest. This does **not** expose the VirgoStars
backend, databases, user accounts, AWS credentials or source repository.
The local server accepts an explicit asset folder and manifest and
serves only files validated against that manifest.

To start development without restricted artwork, an independent
**synthetic** pack generates 78 original checkerboard PNGs matching the
renderer preload paths. They are placeholders, not real zodiac or
planet symbols, and do not demonstrate visual parity.

## Option A — immediate synthetic gallery (no private assets required)

From the `astrological-charts` folder on Windows:

```powershell
powershell -NoProfile -File .\scripts\preview-synthetic.ps1
```

Open **http://127.0.0.1:4177/__preview** in your browser.

Alternatively, use Node.js directly on Windows, macOS or Linux:

```sh
node scripts/generate-synthetic-pack.mjs --out .local/synthetic-pack
node scripts/serve-local-assets.mjs \
  --root .local/synthetic-pack/public/assets \
  --manifest .local/synthetic-pack/manifests/approved-assets.json
```

The generator refuses to overwrite an existing output folder. The
PowerShell launcher reuses a complete synthetic pack or stops when
the local folder is incomplete. Delete `.local/synthetic-pack` manually
**only if** you deliberately want to regenerate your synthetic files.

This generated pack and server have the following properties:

- Creates **78 original 48×48 test PNGs** with the exact names and
  directory paths expected by `GestoreImmagini.preloadArraySimboli`.
- Writes `manifests/approved-assets.json` with SHA-256 checksums and
  synthetic-fixture provenance; it contains no real VirgoStars images,
  stock textures or personal data.
- Verifies the **entire** manifest on server startup and verifies the
  requested file bytes again on each request.
- Serves the gallery at `/__preview` and files under
  `/assets/img/...`. It does not offer directory listing, upload,
  mutation endpoints or public sharing.
- Binds only to `127.0.0.1:4177`. Allowed development CORS origins
  are `http://localhost:4200` and `http://127.0.0.1:4200`.
  **Never expose this development server to the Internet.**

This gallery helps verify filenames, MIME types, paths, asset
availability and manifest rules; it **does not** validate Three.js
scene rendering, astrological accuracy or the final original artwork.

For an actual interactive chart with generated placeholder symbols,
use [the Angular demo guide](ANGULAR_DEMO.md) or
[Start here](START_HERE.md).

## Option B — approved private artwork pack

Only collaborators who have been **explicitly authorized** to access
the private `astrological-assets` repository may use its real images.
Cloning that repository is not needed for the synthetic demo.

When authorized, keep the repositories as sibling directories:

```powershell
git clone https://github.com/Cesare-ml/astrological-assets.git
git clone https://github.com/Cesare-ml/astrological-charts.git
cd astrological-charts
node scripts/serve-local-assets.mjs `
  --root ../astrological-assets/public/assets `
  --manifest ../astrological-assets/manifests/approved-assets.json
```

In a local Angular app, configure the renderer's asset root:

```ts
GestoreImmagini.configurePublicAssetsBase('http://127.0.0.1:4177/assets/');
```

The VirgoStars website continues using its own `/assets/` directory
and existing host-owned image files; the demo uses the local server.
A contributor does not need access to the `virgo-stars` application
repository. The authorized private pack includes images but **not**
the original font, whose redistribution license remains unresolved.

**Warning:** Permission to share artwork with invited collaborators
does not automatically authorize public redistribution. The
repository's CPAL-1.0 source-code license does not license the
separate image files or fonts.

## Manifest contract

The server accepts a nonempty `schemaVersion: 1` approved asset
manifest with records like:

```json
{
  "schemaVersion": 1,
  "assets": [
    {
      "path": "img/simboli-bianchi/segni/01.png",
      "bytes": 1234,
      "sha256": "64 lowercase hexadecimal characters",
      "rightsHolder": "verified rights holder",
      "permissionBasis": "verified legal permission",
      "approvalEvidence": "reference to private evidence"
    }
  ]
}
```

**This example is not a usable manifest.** The file sizes, checksums
and permission details must be generated and independently verified
for actual content. Checks include the physical file, SHA-256
checksum, byte size, extension, exact filename casing and approval
fields. Stating a permission in a JSON string is not a legal audit;
the owner must separately verify the underlying rights.

The server rejects missing, empty or tampered manifests and missing,
unapproved or checksum-mismatched files at startup. Requests for
files outside the approved manifest return **404**. Files that change
after initial validation return **409** when requested.

## Intentional limitations

1. **The gallery is not the interactive Angular demo.** It does not
   execute `GraficoRenderService`, animations or astrology formulas.
   The [separate Angular demo](ANGULAR_DEMO.md) exercises the real
   renderer using synthetic positions, without calculating ephemerides.
2. The 78 placeholders are not visually equivalent to the source
   artwork; reliable skin comparisons require a reviewed real pack.
3. The production asset owner remains the VirgoStars host at
   `virgo-stars/public/assets/`. Do not modify its deployment
   rules or shipped Astrolabio device assets here.
4. Contributor permission constraints: private repositories owned by
   individual GitHub accounts can have restricted collaborator roles.
   Consider an organization when separate read-only roles are needed.
5. No GitHub Actions, npm releases, CDN publication, AWS deployments
   or automatic hardware updates are part of this workflow.

## Local checks

```sh
npm run test:local-assets
npm run test:assets
npm run build
```

Earlier Windows runs exercised the synthetic PNG fixture generator,
manifest integrity, HTTP access, the gallery and rejection of
unapproved files, path traversal, external origins, modified files
and symlinks. Build and Angular demo browser tests were also run
in that earlier work. See [Angular demo](ANGULAR_DEMO.md) for the
commands and remaining limitations; these historic results are
**not a claim that this pull request has been built and retested**.

## Next release gate

Compare real chart output against owner-approved visual reference
images, validate advanced options and test the actual Astrolabio
offline Firefox/e-ink pipeline. Neither this asset gallery nor
synthetic browser tests can replace real device validation.

For publishing prerequisites, see
[the public release checklist](PUBLIC_RELEASE_CHECKLIST.md).
